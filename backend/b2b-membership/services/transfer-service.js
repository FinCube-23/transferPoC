/**
 * Transfer Service
 *
 * Provides business logic for transferring funds between users
 * with atomic operations to ensure data consistency
 */

const mongoose = require("mongoose")
const User = require("../models/user")
const Organization = require("../models/organization")
const { ethers } = require("ethers")
const userManagementService = require("./user-management-service")
require("dotenv").config()

// FinCube contract ABI (only the functions we need)
const FINCUBE_ABI = [
    "function safeTransfer(address to, uint256 amount, string calldata memo, bytes32 nullifier, bytes32 sender_reference_number, bytes32 receiver_reference_number, bytes calldata receiver_proof, bytes32[] calldata receiver_publicInputs) external",
    "function approvedERC20() external view returns (address)",
]

// ERC20 ABI for approve function
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
]

class TransferService {
    /**
     * Transfer funds from one user to another atomically
     *
     * @param {number} fromUserId - Source user's user_id
     * @param {number} toUserId - Destination user's user_id
     * @param {number} amount - Amount to transfer (must be positive)
     * @returns {Promise<{success: boolean, transaction?: object, error?: object}>}
     *
     * @example
     * const result = await transfer(2001, 2002, 50)
     * if (result.success) {
     *   console.log("Transfer completed:", result.transaction)
     * }
     */
    async transfer(fromUserId, toUserId, amount) {
        // Validate inputs
        const validation = this._validateTransferInputs(
            fromUserId,
            toUserId,
            amount
        )
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
            }
        }

        // Check if transactions are supported (replica set)
        const supportsTransactions = await this._checkTransactionSupport()

        if (supportsTransactions) {
            return await this._transferWithTransaction(
                fromUserId,
                toUserId,
                amount
            )
        } else {
            return await this._transferWithoutTransaction(
                fromUserId,
                toUserId,
                amount
            )
        }
    }

    /**
     * Check if MongoDB supports transactions (replica set)
     * @private
     */
    async _checkTransactionSupport() {
        try {
            const admin = mongoose.connection.db.admin()
            const serverInfo = await admin.serverStatus()
            // Check if running as replica set
            return serverInfo.repl && serverInfo.repl.setName
        } catch (error) {
            // If we can't determine, assume no transaction support
            return false
        }
    }

    /**
     * Transfer with MongoDB transactions (for replica sets)
     * @private
     */
    async _transferWithTransaction(fromUserId, toUserId, amount) {
        const session = await mongoose.startSession()

        try {
            let result
            await session.withTransaction(async () => {
                // Find sender
                const sender = await User.findOne({
                    user_id: fromUserId,
                }).session(session)

                if (!sender) {
                    throw new Error(
                        `Sender not found with user_id: ${fromUserId}`
                    )
                }

                // Find receiver
                const receiver = await User.findOne({
                    user_id: toUserId,
                }).session(session)

                if (!receiver) {
                    throw new Error(
                        `Receiver not found with user_id: ${toUserId}`
                    )
                }

                // Check if sender has sufficient balance
                if (sender.balance < amount) {
                    throw new Error(
                        `Insufficient balance. Available: ${sender.balance}, Required: ${amount}`
                    )
                }

                // Calculate new balances
                const newSenderBalance = sender.balance - amount
                const newReceiverBalance = receiver.balance + amount

                // Validate new balances are non-negative
                if (newSenderBalance < 0) {
                    throw new Error(
                        `Transfer would result in negative balance for sender`
                    )
                }

                // Update sender balance
                const senderUpdate = await User.updateOne(
                    { user_id: fromUserId },
                    { $set: { balance: newSenderBalance } }
                ).session(session)

                if (senderUpdate.modifiedCount !== 1) {
                    throw new Error("Failed to update sender balance")
                }

                // Update receiver balance
                const receiverUpdate = await User.updateOne(
                    { user_id: toUserId },
                    { $set: { balance: newReceiverBalance } }
                ).session(session)

                if (receiverUpdate.modifiedCount !== 1) {
                    throw new Error("Failed to update receiver balance")
                }

                // Prepare transaction result
                result = {
                    fromUserId,
                    toUserId,
                    amount,
                    senderPreviousBalance: sender.balance,
                    senderNewBalance: newSenderBalance,
                    receiverPreviousBalance: receiver.balance,
                    receiverNewBalance: newReceiverBalance,
                    timestamp: new Date(),
                    transactionMode: "with_session",
                }
            })

            await session.endSession()

            return {
                success: true,
                transaction: result,
            }
        } catch (error) {
            await session.endSession()

            return this._formatError(error, fromUserId, toUserId, amount)
        }
    }

    /**
     * Transfer without transactions (for standalone MongoDB)
     * Uses optimistic locking with findOneAndUpdate
     * @private
     */
    async _transferWithoutTransaction(fromUserId, toUserId, amount) {
        try {
            // Find sender
            const sender = await User.findOne({ user_id: fromUserId })

            if (!sender) {
                throw new Error(`Sender not found with user_id: ${fromUserId}`)
            }

            // Find receiver
            const receiver = await User.findOne({ user_id: toUserId })

            if (!receiver) {
                throw new Error(`Receiver not found with user_id: ${toUserId}`)
            }

            // Check if sender has sufficient balance
            if (sender.balance < amount) {
                throw new Error(
                    `Insufficient balance. Available: ${sender.balance}, Required: ${amount}`
                )
            }

            // Calculate new balances
            const newSenderBalance = sender.balance - amount
            const newReceiverBalance = receiver.balance + amount

            // Validate new balances are non-negative
            if (newSenderBalance < 0) {
                throw new Error(
                    `Transfer would result in negative balance for sender`
                )
            }

            // Update sender balance with optimistic locking
            // Only update if balance hasn't changed since we read it
            const senderUpdate = await User.findOneAndUpdate(
                {
                    user_id: fromUserId,
                    balance: sender.balance, // Optimistic lock
                },
                { $set: { balance: newSenderBalance } },
                { new: false }
            )

            if (!senderUpdate) {
                throw new Error(
                    "Failed to update sender balance - balance was modified by another operation"
                )
            }

            // Update receiver balance with optimistic locking
            const receiverUpdate = await User.findOneAndUpdate(
                {
                    user_id: toUserId,
                    balance: receiver.balance, // Optimistic lock
                },
                { $set: { balance: newReceiverBalance } },
                { new: false }
            )

            if (!receiverUpdate) {
                // Rollback sender update
                await User.updateOne(
                    { user_id: fromUserId },
                    { $set: { balance: sender.balance } }
                )
                throw new Error(
                    "Failed to update receiver balance - balance was modified by another operation. Sender balance rolled back."
                )
            }

            // Prepare transaction result
            const result = {
                fromUserId,
                toUserId,
                amount,
                senderPreviousBalance: sender.balance,
                senderNewBalance: newSenderBalance,
                receiverPreviousBalance: receiver.balance,
                receiverNewBalance: newReceiverBalance,
                timestamp: new Date(),
                transactionMode: "optimistic_locking",
            }

            return {
                success: true,
                transaction: result,
            }
        } catch (error) {
            return this._formatError(error, fromUserId, toUserId, amount)
        }
    }

    /**
     * Format error response
     * @private
     */
    _formatError(error, fromUserId, toUserId, amount) {
        // Determine error type
        let errorType = "TRANSFER_FAILED"
        if (error.message.includes("not found")) {
            errorType = "USER_NOT_FOUND"
        } else if (error.message.includes("Insufficient balance")) {
            errorType = "INSUFFICIENT_BALANCE"
        } else if (error.message.includes("negative balance")) {
            errorType = "INVALID_BALANCE"
        } else if (error.message.includes("modified by another operation")) {
            errorType = "CONCURRENT_MODIFICATION"
        }

        return {
            success: false,
            error: {
                type: errorType,
                message: error.message,
                details: {
                    fromUserId,
                    toUserId,
                    amount,
                },
            },
        }
    }

    /**
     * Validate transfer inputs
     * @private
     */
    _validateTransferInputs(fromUserId, toUserId, amount) {
        // Validate fromUserId
        if (
            typeof fromUserId !== "number" ||
            !Number.isInteger(fromUserId) ||
            fromUserId <= 0
        ) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "fromUserId must be a positive integer",
                    details: { fromUserId },
                },
            }
        }

        // Validate toUserId
        if (
            typeof toUserId !== "number" ||
            !Number.isInteger(toUserId) ||
            toUserId <= 0
        ) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "toUserId must be a positive integer",
                    details: { toUserId },
                },
            }
        }

        // Validate amount
        if (typeof amount !== "number" || amount <= 0) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "amount must be a positive number",
                    details: { amount },
                },
            }
        }

        // Check if sender and receiver are the same
        if (fromUserId === toUserId) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "Cannot transfer to the same user",
                    details: { fromUserId, toUserId },
                },
            }
        }

        return { valid: true }
    }

    /**
     * Execute blockchain transfer using FinCube smart contract
     * The transaction is signed and sent by the wallet configured in .env
     *
     * @param {number} fromUserId - Source user's user_id
     * @param {number} toUserId - Destination user's user_id
     * @param {number} amount - Amount to transfer (in token units, e.g., 50 for 50 USDC)
     * @param {string} memo - Transfer memo/reference
     * @param {string} nullifier - Unique nullifier (32 bytes hex, e.g., "0x1234...")
     * @param {string} receiverProof - ZKP proof for receiver (hex format)
     * @param {string[]} receiverPublicInputs - Array of public inputs for ZKP (array of hex strings)
     * @returns {Promise<{success: boolean, transaction?: object, error?: object}>}
     *
     * @example
     * const result = await blockchainTransfer(
     *   2001,
     *   2002,
     *   50,
     *   "Payment for services",
     *   "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
     *   "0xproof...",
     *   ["0xinput1...", "0xinput2..."]
     * )
     */
    async blockchainTransfer(
        fromUserId,
        toUserId,
        amount,
        memo,
        nullifier,
        receiverProof,
        receiverPublicInputs
    ) {
        try {
            // Validate inputs
            const validation = this._validateBlockchainTransferInputs(
                fromUserId,
                toUserId,
                amount,
                memo,
                nullifier,
                receiverProof,
                receiverPublicInputs
            )
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                }
            }

            // Get environment variables
            const alchemyUrl = process.env.ALCHEMY_URL
            const privateKey = process.env.WALLET_PRIVATE_KEY
            const finCubeAddress = process.env.FINCUBE_CONTRACT_ADDRESS

            if (!alchemyUrl || !privateKey || !finCubeAddress) {
                throw new Error(
                    "Missing required environment variables: ALCHEMY_URL, WALLET_PRIVATE_KEY, or FINCUBE_CONTRACT_ADDRESS"
                )
            }

            // Setup provider and wallet
            const provider = new ethers.JsonRpcProvider(alchemyUrl)
            const wallet = new ethers.Wallet(privateKey, provider)

            // Get FinCube contract instance
            const finCubeContract = new ethers.Contract(
                finCubeAddress,
                FINCUBE_ABI,
                wallet
            )

            // Fetch users from database
            const sender = await User.findOne({ user_id: fromUserId })
            if (!sender) {
                throw new Error(`Sender not found with user_id: ${fromUserId}`)
            }

            const receiver = await User.findOne({ user_id: toUserId })
            if (!receiver) {
                throw new Error(`Receiver not found with user_id: ${toUserId}`)
            }

            // Get sender and receiver wallet addresses from their organizations
            const senderOrg =
                await userManagementService.getOrganizationByReferenceNumber(
                    sender.reference_number
                )
            if (!senderOrg.success) {
                throw new Error(
                    `Sender organization not found for reference number: ${sender.reference_number}`
                )
            }

            const receiverOrg = await userManagementService.getOrganizationByReferenceNumber(
                receiver.reference_number
            )
            if (!receiverOrg.success) {
                throw new Error(
                    `Receiver organization not found for reference number: ${receiver.reference_number}`
                )
            }

            const senderWalletAddress = senderOrg?.organization?.wallet_address
            const receiverWalletAddress = receiverOrg?.organization?.wallet_address

            // Get reference numbers and convert to bytes32 format
            const senderReferenceNumber = sender.reference_number
                ? this._convertToBytes32(sender.reference_number)
                : "0x0000000000000000000000000000000000000000000000000000000000000000"
            const receiverReferenceNumber = receiver.reference_number
                ? this._convertToBytes32(receiver.reference_number)
                : "0x0000000000000000000000000000000000000000000000000000000000000000"

            // Convert amount to wei (assuming 18 decimals for the token)
            const amountInWei = ethers.parseUnits(amount.toString(), 18)

            // Call safeTransfer on the FinCube contract
            const tx = await finCubeContract.safeTransfer(
                receiverWalletAddress,
                amountInWei,
                memo,
                nullifier,
                senderReferenceNumber,
                receiverReferenceNumber,
                receiverProof,
                receiverPublicInputs
            )

            // Wait for transaction confirmation
            const receipt = await tx.wait()

            // Return success response
            return {
                success: true,
                transaction: {
                    fromUserId,
                    toUserId,
                    amount,
                    memo,
                    nullifier,
                    senderWalletAddress,
                    receiverWalletAddress,
                    senderReferenceNumber,
                    receiverReferenceNumber,
                    transactionHash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                    timestamp: new Date(),
                },
            }
        } catch (error) {
            return this._formatBlockchainError(
                error,
                fromUserId,
                toUserId,
                amount
            )
        }
    }

    /**
     * Validate blockchain transfer inputs
     * @private
     */
    _validateBlockchainTransferInputs(
        fromUserId,
        toUserId,
        amount,
        memo,
        nullifier,
        receiverProof,
        receiverPublicInputs
    ) {
        // Validate user IDs and amount (reuse existing validation)
        const basicValidation = this._validateTransferInputs(
            fromUserId,
            toUserId,
            amount
        )
        if (!basicValidation.valid) {
            return basicValidation
        }

        // Validate memo
        if (typeof memo !== "string" || memo.trim().length === 0) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "memo must be a non-empty string",
                    details: { memo },
                },
            }
        }

        // Validate nullifier (should be 32 bytes hex string)
        if (
            typeof nullifier !== "string" ||
            !nullifier.match(/^0x[0-9a-fA-F]{64}$/)
        ) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message:
                        "nullifier must be a 32-byte hex string (0x + 64 hex chars)",
                    details: { nullifier },
                },
            }
        }

        // Validate receiverProof
        if (
            typeof receiverProof !== "string" ||
            !receiverProof.startsWith("0x")
        ) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message:
                        "receiverProof must be a hex string starting with 0x",
                    details: { receiverProof },
                },
            }
        }

        // Validate receiverPublicInputs
        if (!Array.isArray(receiverPublicInputs)) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "receiverPublicInputs must be an array",
                    details: { receiverPublicInputs },
                },
            }
        }

        // Validate each public input is a hex string
        for (let i = 0; i < receiverPublicInputs.length; i++) {
            const input = receiverPublicInputs[i]
            if (typeof input !== "string" || !input.startsWith("0x")) {
                return {
                    valid: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: `receiverPublicInputs[${i}] must be a hex string starting with 0x`,
                        details: { index: i, value: input },
                    },
                }
            }
        }

        return { valid: true }
    }

    /**
     * Convert reference number string to bytes32 format
     * Uses keccak256 hash to ensure consistent 32-byte output
     * @private
     * @param {string} referenceNumber - Reference number to convert
     * @returns {string} 32-byte hex string with 0x prefix
     */
    _convertToBytes32(referenceNumber) {
        // Use ethers.id() which is keccak256 hash of the string
        // This ensures we get a consistent 32-byte value
        return ethers.id(referenceNumber)
    }

    /**
     * Format blockchain error response
     * @private
     */
    _formatBlockchainError(error, fromUserId, toUserId, amount) {
        let errorType = "BLOCKCHAIN_TRANSFER_FAILED"
        let errorMessage = error.message

        // Parse specific error types
        if (error.message.includes("not found")) {
            errorType = "USER_NOT_FOUND"
        } else if (error.message.includes("not verified")) {
            errorType = "ZKP_VERIFICATION_FAILED"
        } else if (error.message.includes("not member")) {
            errorType = "NOT_DAO_MEMBER"
        } else if (error.message.includes("Insufficient allowance")) {
            errorType = "INSUFFICIENT_ALLOWANCE"
        } else if (error.message.includes("Insufficient balance")) {
            errorType = "INSUFFICIENT_BALANCE"
        } else if (error.message.includes("Nullifier already used")) {
            errorType = "NULLIFIER_ALREADY_USED"
        } else if (error.message.includes("Missing required environment")) {
            errorType = "CONFIGURATION_ERROR"
        }

        return {
            success: false,
            error: {
                type: errorType,
                message: errorMessage,
                details: {
                    fromUserId,
                    toUserId,
                    amount,
                },
            },
        }
    }
}

// Export singleton instance
module.exports = new TransferService()
