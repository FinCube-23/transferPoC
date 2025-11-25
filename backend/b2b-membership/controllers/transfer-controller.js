/**
 * Transfer Controller
 *
 * Orchestrates ZKP-enabled transfers between users including:
 * - User data retrieval
 * - ZKP proof generation for receiver
 * - Nullifier generation
 * - Memo creation and validation
 * - Blockchain transfer execution
 * - Database balance updates
 */

const crypto = require("crypto")
const { Logger } = require("../utils/logger")
const userManagementService = require("../services/user-management-service")
const ProofController = require("./proof-controller")
const transferService = require("../services/transfer-service")
const { publishTransactionReceipt } = require("../utils/rabbitmq-publisher")
const User = require("../models/user")
const Organization = require("../models/organization")

class TransferController {
    constructor() {
        this.logger = new Logger("TransferController")
        this.proofController = new ProofController()
    }

    /**
     * Execute transfer from sender to receiver
     * POST /api/transfer
     *
     * @param {object} req - Express request object
     * @param {object} req.body - Request body
     * @param {string} req.body.receiver_reference_number - Receiver's reference number
     * @param {number} req.body.amount - Transfer amount
     * @param {number} req.body.sender_user_id - Sender's user ID
     * @param {object} res - Express response object
     * @returns {Promise<void>}
     */
    async executeTransfer(req, res) {
        const workflowStartTime = Date.now()

        this.logger.info("========================================")
        this.logger.info("Starting Transfer Workflow")
        this.logger.info("========================================")

        try {
            const { receiver_reference_number, amount, sender_user_id } =
                req.body

            // Log request parameters (sanitized)
            this.logger.info("Transfer request received", {
                receiver_reference_number,
                amount,
                sender_user_id,
            })

            // Step 1: Validate inputs
            const validationResult = this._validateTransferInputs(
                receiver_reference_number,
                amount,
                sender_user_id
            )

            if (!validationResult.valid) {
                this.logger.error(
                    "Input validation failed",
                    validationResult.error
                )
                return res.status(400).json({
                    success: false,
                    error: validationResult.error,
                })
            }

            // Step 2: Retrieve user data
            const dataRetrievalStart = Date.now()
            this.logger.info("[STEP 1/7] Retrieving user data...")

            const userDataResult = await this._retrieveUserData(
                receiver_reference_number,
                sender_user_id
            )

            if (!userDataResult.success) {
                const dataRetrievalDuration = Date.now() - dataRetrievalStart
                this.logger.error("User data retrieval failed", {
                    duration: `${dataRetrievalDuration}ms`,
                    error: userDataResult.error,
                })

                const statusCode =
                    userDataResult.error.type === "USER_NOT_FOUND" ||
                    userDataResult.error.type === "ORGANIZATION_NOT_FOUND"
                        ? 404
                        : 500

                return res.status(statusCode).json({
                    success: false,
                    error: userDataResult.error,
                })
            }

            const { sender, receiver, receiverOrg, senderOrg } =
                userDataResult.data
            const dataRetrievalDuration = Date.now() - dataRetrievalStart
            this.logger.info("User data retrieved successfully", {
                duration: `${dataRetrievalDuration}ms`,
                sender_user_id: sender.user_id,
                receiver_user_id: receiver.user_id,
            })

            // Check if sender and receiver are from the same organization
            const isSameOrganization = senderOrg.org_id === receiverOrg.org_id

            if (isSameOrganization) {
                this.logger.info(
                    "Same organization transfer detected - skipping blockchain and proof generation",
                    {
                        org_id: senderOrg.org_id,
                        wallet_address: senderOrg.wallet_address,
                    }
                )

                // For same-organization transfers, only do database transaction
                const databaseUpdateStart = Date.now()
                this.logger.info("Executing database-only transfer...")

                const dbResult = await transferService.transfer(
                    sender.user_id,
                    receiver.user_id,
                    amount
                )

                const databaseUpdateDuration = Date.now() - databaseUpdateStart

                if (!dbResult.success) {
                    this.logger.error("Database transfer failed", {
                        duration: `${databaseUpdateDuration}ms`,
                        error: dbResult.error,
                    })

                    return res.status(500).json({
                        success: false,
                        error: dbResult.error,
                    })
                }

                this.logger.info("Database transfer completed successfully", {
                    duration: `${databaseUpdateDuration}ms`,
                })

                const totalDuration = Date.now() - workflowStartTime
                this.logger.info(
                    "Same-organization transfer completed successfully",
                    {
                        totalDuration: `${totalDuration}ms`,
                    }
                )

                return res.status(200).json({
                    success: true,
                    transferType: "SAME_ORGANIZATION",
                    database: dbResult.transaction,
                })
            }

            // Step 3: Generate ZKP proof for receiver (cross-organization transfer)
            const proofGenerationStart = Date.now()
            this.logger.info("[STEP 2/7] Generating ZKP proof for receiver...")

            const proofResult = await this._generateProof(
                receiver.user_id,
                receiverOrg.org_id
            )

            if (!proofResult.success) {
                const proofGenerationDuration =
                    Date.now() - proofGenerationStart
                this.logger.error("Proof generation failed", {
                    duration: `${proofGenerationDuration}ms`,
                    error: proofResult.error,
                })

                return res.status(500).json({
                    success: false,
                    error: proofResult.error,
                })
            }

            const { proof, publicInputs } = proofResult
            const proofGenerationDuration = Date.now() - proofGenerationStart
            this.logger.info("Proof generated successfully", {
                duration: `${proofGenerationDuration}ms`,
            })

            // Step 4: Generate nullifier
            const nullifierGenerationStart = Date.now()
            this.logger.info("[STEP 3/7] Generating nullifier...")

            const nullifier = this._generateNullifier()
            const nullifierGenerationDuration =
                Date.now() - nullifierGenerationStart
            this.logger.info("Nullifier generated", {
                duration: `${nullifierGenerationDuration}ms`,
                nullifier,
            })

            // Step 5: Create memo
            const memoCreationStart = Date.now()
            this.logger.info("[STEP 4/7] Creating transfer memo...")

            const memo = this._createMemo(
                sender.reference_number,
                receiver.reference_number,
                senderOrg.wallet_address,
                receiverOrg.wallet_address,
                amount
            )

            // Validate memo length
            const memoValidation = this._validateMemoLength(memo)
            if (!memoValidation.valid) {
                const memoCreationDuration = Date.now() - memoCreationStart
                this.logger.error("Memo validation failed", {
                    duration: `${memoCreationDuration}ms`,
                    error: memoValidation.error,
                })

                return res.status(400).json({
                    success: false,
                    error: memoValidation.error,
                })
            }

            const memoCreationDuration = Date.now() - memoCreationStart
            this.logger.info("Memo created and validated", {
                duration: `${memoCreationDuration}ms`,
                memoLength: Buffer.byteLength(memo, "utf8"),
            })

            // Step 6: Execute blockchain transfer
            const blockchainTransferStart = Date.now()
            this.logger.info("[STEP 5/7] Executing blockchain transfer...")

            const blockchainResult = await transferService.blockchainTransfer(
                sender.user_id,
                receiver.user_id,
                amount,
                memo,
                nullifier,
                proof,
                publicInputs
            )

            if (!blockchainResult.success) {
                const blockchainTransferDuration =
                    Date.now() - blockchainTransferStart
                this.logger.error("Blockchain transfer failed", {
                    duration: `${blockchainTransferDuration}ms`,
                    error: blockchainResult.error,
                })

                return res.status(500).json({
                    success: false,
                    error: blockchainResult.error,
                })
            }

            const blockchainTransferDuration =
                Date.now() - blockchainTransferStart
            this.logger.info("Blockchain transfer completed", {
                duration: `${blockchainTransferDuration}ms`,
                transactionHash: blockchainResult.transaction.transactionHash,
            })

            // Step 7: Publish transaction receipt to RabbitMQ
            const publishEventStart = Date.now()
            this.logger.info(
                "[STEP 6/7] Publishing transaction receipt to RabbitMQ..."
            )

            try {
                // Get chain ID from blockchain result or use configured value
                const chainId =
                    blockchainResult.transaction.chainId ||
                    process.env.CHAIN_ID ||
                    "unknown"

                await publishTransactionReceipt({
                    transactionHash:
                        blockchainResult.transaction.transactionHash,
                    signedBy: blockchainResult.transaction.senderWalletAddress,
                    chainId: chainId.toString(),
                    context: {
                        fromUserId: sender.user_id,
                        toUserId: receiver.user_id,
                        amount,
                        senderWalletAddress:
                            blockchainResult.transaction.senderWalletAddress,
                        receiverWalletAddress:
                            blockchainResult.transaction.receiverWalletAddress,
                        blockNumber: blockchainResult.transaction.blockNumber,
                        gasUsed: blockchainResult.transaction.gasUsed,
                        memo,
                        nullifier,
                    },
                })

                const publishEventDuration = Date.now() - publishEventStart
                this.logger.info("Transaction receipt published successfully", {
                    duration: `${publishEventDuration}ms`,
                    transactionHash:
                        blockchainResult.transaction.transactionHash,
                    chainId,
                })
            } catch (publishError) {
                const publishEventDuration = Date.now() - publishEventStart
                // Log error but don't fail the transaction
                this.logger.warn(
                    "Failed to publish transaction receipt to RabbitMQ",
                    {
                        duration: `${publishEventDuration}ms`,
                        error: publishError.message,
                        transactionHash:
                            blockchainResult.transaction.transactionHash,
                    }
                )
            }

            // Step 8: Update database balances
            const databaseUpdateStart = Date.now()
            this.logger.info("[STEP 7/7] Updating database balances...")

            const dbResult = await transferService.transfer(
                sender.user_id,
                receiver.user_id,
                amount
            )

            const databaseUpdateDuration = Date.now() - databaseUpdateStart

            if (!dbResult.success) {
                // Blockchain succeeded but database failed - partial success
                this.logger.warn(
                    "Database update failed after blockchain success",
                    {
                        duration: `${databaseUpdateDuration}ms`,
                        error: dbResult.error,
                        transactionHash:
                            blockchainResult.transaction.transactionHash,
                    }
                )

                const totalDuration = Date.now() - workflowStartTime
                this.logger.info("Transfer workflow completed with warning", {
                    totalDuration: `${totalDuration}ms`,
                })

                return res.status(200).json({
                    success: true,
                    warning: "BLOCKCHAIN_SUCCEEDED_DATABASE_FAILED",
                    blockchain: blockchainResult.transaction,
                    database: {
                        error: dbResult.error.message,
                        details: dbResult.error.details,
                    },
                })
            }

            this.logger.info("Database balances updated successfully", {
                duration: `${databaseUpdateDuration}ms`,
            })

            // Success - both blockchain and database succeeded
            const totalDuration = Date.now() - workflowStartTime
            this.logger.info("Transfer workflow completed successfully", {
                totalDuration: `${totalDuration}ms`,
            })

            return res.status(200).json({
                success: true,
                blockchain: blockchainResult.transaction,
                database: dbResult.transaction,
            })
        } catch (error) {
            const totalDuration = Date.now() - workflowStartTime
            this.logger.error("Unexpected error in transfer workflow", {
                totalDuration: `${totalDuration}ms`,
                error: error.message,
                stack: error.stack,
            })

            return res.status(500).json({
                success: false,
                error: {
                    type: "INTERNAL_ERROR",
                    message: "An unexpected error occurred during transfer",
                    details: {
                        error: error.message,
                    },
                },
            })
        }
    }

    /**
     * Validate transfer request inputs
     * @private
     * @param {string} receiver_reference_number - Receiver's reference number
     * @param {number} amount - Transfer amount
     * @param {number} sender_user_id - Sender's user ID
     * @returns {{valid: boolean, error?: object}}
     */
    _validateTransferInputs(receiver_reference_number, amount, sender_user_id) {
        // Validate receiver_reference_number
        if (
            !receiver_reference_number ||
            typeof receiver_reference_number !== "string" ||
            receiver_reference_number.trim().length === 0
        ) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message:
                        "receiver_reference_number must be a non-empty string",
                    details: { receiver_reference_number },
                },
            }
        }

        // Validate amount
        if (typeof amount !== "number" || amount <= 0 || !isFinite(amount)) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "amount must be a positive number",
                    details: { amount },
                },
            }
        }

        // Validate sender_user_id
        if (
            typeof sender_user_id !== "number" ||
            !Number.isInteger(sender_user_id) ||
            sender_user_id <= 0
        ) {
            return {
                valid: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "sender_user_id must be a positive integer",
                    details: { sender_user_id },
                },
            }
        }

        return { valid: true }
    }

    /**
     * Retrieve sender and receiver user data
     * @private
     * @param {string} receiver_reference_number - Receiver's reference number
     * @param {number} sender_user_id - Sender's user ID
     * @returns {Promise<{success: boolean, data?: object, error?: object}>}
     */
    async _retrieveUserData(receiver_reference_number, sender_user_id) {
        try {
            // Get receiver organization from reference number
            const receiverOrgResult =
                await userManagementService.getOrganizationByReferenceNumber(
                    receiver_reference_number
                )

            if (!receiverOrgResult.success) {
                return {
                    success: false,
                    error: receiverOrgResult.error,
                }
            }

            const receiverOrg = receiverOrgResult.organization

            // Find receiver user by reference_number with populated batch_id
            const receiver = await User.findOne({
                reference_number: receiver_reference_number,
            }).populate("batch_id")

            if (!receiver) {
                return {
                    success: false,
                    error: {
                        type: "USER_NOT_FOUND",
                        message: `Receiver not found with reference_number: ${receiver_reference_number}`,
                        details: {
                            receiver_reference_number,
                        },
                    },
                }
            }

            // Find sender user by user_id with populated batch_id
            const sender = await User.findOne({
                user_id: sender_user_id,
            }).populate("batch_id")

            if (!sender) {
                return {
                    success: false,
                    error: {
                        type: "USER_NOT_FOUND",
                        message: `Sender not found with user_id: ${sender_user_id}`,
                        details: {
                            sender_user_id,
                        },
                    },
                }
            }

            // Get sender organization from sender's reference number
            const senderOrgResult =
                await userManagementService.getOrganizationByReferenceNumber(
                    sender.reference_number
                )

            if (!senderOrgResult.success) {
                return {
                    success: false,
                    error: {
                        type: "ORGANIZATION_NOT_FOUND",
                        message: "Sender organization not found",
                        details: {
                            reference_number: sender.reference_number,
                            error: senderOrgResult.error,
                        },
                    },
                }
            }

            const senderOrg = senderOrgResult.organization

            return {
                success: true,
                data: {
                    sender,
                    receiver,
                    receiverOrg,
                    senderOrg,
                },
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    type: "DATABASE_ERROR",
                    message: "Failed to retrieve user data",
                    details: {
                        error: error.message,
                    },
                },
            }
        }
    }

    /**
     * Generate ZKP proof for receiver
     * @private
     * @param {number} receiver_user_id - Receiver's user ID
     * @param {number} receiver_org_id - Receiver's organization ID
     * @returns {Promise<{success: boolean, proof?: string, publicInputs?: string[], error?: object}>}
     */
    async _generateProof(receiver_user_id, receiver_org_id) {
        try {
            // Call ProofController.generateProofService with receiver data
            const proofResult = await this.proofController.generateProofService(
                receiver_user_id,
                receiver_org_id,
                true // isKYCed - default to true
            )

            if (!proofResult.success) {
                return {
                    success: false,
                    error: {
                        type: "PROOF_GENERATION_FAILED",
                        message: "Failed to generate ZKP proof for receiver",
                        details: proofResult.error,
                    },
                }
            }

            // Validate proof format (hex string starting with 0x)
            if (
                typeof proofResult.proof !== "string" ||
                !proofResult.proof.startsWith("0x")
            ) {
                return {
                    success: false,
                    error: {
                        type: "PROOF_GENERATION_FAILED",
                        message:
                            "Invalid proof format: must be hex string starting with 0x",
                        details: {
                            proof: proofResult.proof,
                        },
                    },
                }
            }

            // Validate publicInputs format (array of hex strings starting with 0x)
            if (!Array.isArray(proofResult.publicInputs)) {
                return {
                    success: false,
                    error: {
                        type: "PROOF_GENERATION_FAILED",
                        message:
                            "Invalid publicInputs format: must be an array",
                        details: {
                            publicInputs: proofResult.publicInputs,
                        },
                    },
                }
            }

            for (let i = 0; i < proofResult.publicInputs.length; i++) {
                const input = proofResult.publicInputs[i]
                if (typeof input !== "string" || !input.startsWith("0x")) {
                    return {
                        success: false,
                        error: {
                            type: "PROOF_GENERATION_FAILED",
                            message: `Invalid publicInputs[${i}] format: must be hex string starting with 0x`,
                            details: {
                                index: i,
                                value: input,
                            },
                        },
                    }
                }
            }

            return {
                success: true,
                proof: proofResult.proof,
                publicInputs: proofResult.publicInputs,
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    type: "PROOF_GENERATION_FAILED",
                    message: "Error during proof generation",
                    details: {
                        error: error.message,
                    },
                },
            }
        }
    }

    /**
     * Generate unique nullifier for transfer
     * @private
     * @returns {string} 32-byte hex string with 0x prefix
     */
    _generateNullifier() {
        // Generate 32 bytes of cryptographically secure random data
        const randomBytes = crypto.randomBytes(32)

        // Convert to hex string with 0x prefix
        const nullifier = "0x" + randomBytes.toString("hex")

        // Validate format matches /^0x[0-9a-fA-F]{64}$/
        if (!nullifier.match(/^0x[0-9a-fA-F]{64}$/)) {
            throw new Error(
                "Generated nullifier does not match expected format"
            )
        }

        return nullifier
    }

    /**
     * Create transfer memo with metadata
     * Handles missing reference numbers by using empty strings
     * @private
     * @param {string} senderRefNumber - Sender's reference number
     * @param {string} receiverRefNumber - Receiver's reference number
     * @param {string} senderWallet - Sender's wallet address
     * @param {string} receiverWallet - Receiver's wallet address
     * @param {number} amount - Transfer amount
     * @returns {string} JSON memo string
     */
    _createMemo(
        senderRefNumber,
        receiverRefNumber,
        senderWallet,
        receiverWallet,
        amount
    ) {
        const memoObject = {
            sender_reference_number: senderRefNumber || "",
            receiver_reference_number: receiverRefNumber || "",
            sender_wallet_address: senderWallet,
            receiver_wallet_address: receiverWallet,
            amount,
            timestamp: new Date().toISOString(),
        }

        return JSON.stringify(memoObject)
    }

    /**
     * Validate memo length against maximum allowed
     * @private
     * @param {string} memo - Memo string to validate
     * @returns {{valid: boolean, error?: object}}
     */
    _validateMemoLength(memo) {
        const MAX_MEMO_LENGTH = 1024 // bytes

        // Get UTF-8 encoded byte length
        const memoByteLength = Buffer.byteLength(memo, "utf8")

        if (memoByteLength > MAX_MEMO_LENGTH) {
            return {
                valid: false,
                error: {
                    type: "MEMO_TOO_LONG",
                    message: `Memo exceeds maximum length of ${MAX_MEMO_LENGTH} bytes`,
                    details: {
                        memoLength: memoByteLength,
                        maxLength: MAX_MEMO_LENGTH,
                    },
                },
            }
        }

        return { valid: true }
    }
}

module.exports = TransferController
