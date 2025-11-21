/**
 * Transfer Service
 *
 * Provides business logic for transferring funds between users
 * with atomic operations to ensure data consistency
 */

const mongoose = require("mongoose")
const User = require("../models/user")

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
}

// Export singleton instance
module.exports = new TransferService()
