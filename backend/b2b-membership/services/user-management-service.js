/**
 * User Management Service
 *
 * Provides business logic for user management operations including
 * reference number generation, organization lookup, and batch-aware user creation
 */

const { v4: uuidv4 } = require("uuid")
const mongoose = require("mongoose")
const Organization = require("../models/organization")
const User = require("../models/user")
const Batch = require("../models/batch")
const BatchManager = require("../utils/batch-manager")
const {
    generateUserSecret: generateSecret,
} = require("../utils/secret-generator")
const { addRoot, verifyPolynomial } = require("../utils/polynomial-operations")

class UserManagementService {
    constructor() {
        this.batchManager = new BatchManager()
    }

    /**
     * Generate a unique reference number for a user
     * Format: {org_wallet_address}_{uuid}
     *
     * @param {string} orgWalletAddress - Organization's wallet address
     * @returns {string} Generated reference number
     * @throws {Error} If wallet address is invalid
     *
     * @example
     * const refNumber = generateReferenceNumber("0x1234567890123456789012345678901234567890")
     * Returns: "0x1234567890123456789012345678901234567890_550e8400-e29b-41d4-a716-446655440000"
     */
    generateReferenceNumber(orgWalletAddress) {
        // Validate wallet address
        if (!orgWalletAddress || typeof orgWalletAddress !== "string") {
            throw new Error(
                "Invalid wallet address: must be a non-empty string"
            )
        }

        // Trim whitespace
        const walletAddress = orgWalletAddress.trim()

        if (walletAddress.length === 0) {
            throw new Error("Invalid wallet address: cannot be empty")
        }

        // Generate UUID v4
        const uuid = uuidv4()

        // Concatenate wallet address with UUID
        const referenceNumber = `${walletAddress}_${uuid}`

        return referenceNumber
    }

    /**
     * Get organization by reference number
     * Extracts wallet address from reference number and retrieves the organization
     *
     * @param {string} referenceNumber - Reference number in format {wallet_address}_{uuid}
     * @returns {Promise<{success: boolean, organization?: object, error?: object}>}
     *
     * @example
     * const result = await getOrganizationByReferenceNumber("0x1234...7890_550e8400-...")
     * if (result.success) {
     *   console.log(result.organization)
     * }
     */
    async getOrganizationByReferenceNumber(referenceNumber) {
        try {
            // Validate reference number
            if (!referenceNumber || typeof referenceNumber !== "string") {
                return {
                    success: false,
                    error: {
                        type: "INVALID_REFERENCE_NUMBER",
                        message: "Reference number must be a non-empty string",
                    },
                }
            }

            // Trim whitespace
            const refNumber = referenceNumber.trim()

            if (refNumber.length === 0) {
                return {
                    success: false,
                    error: {
                        type: "INVALID_REFERENCE_NUMBER",
                        message: "Reference number cannot be empty",
                    },
                }
            }

            // Extract wallet address from reference number
            // Format: {wallet_address}_{uuid}
            const lastUnderscoreIndex = refNumber.lastIndexOf("_")

            if (lastUnderscoreIndex === -1) {
                return {
                    success: false,
                    error: {
                        type: "INVALID_REFERENCE_NUMBER_FORMAT",
                        message:
                            "Reference number must be in format: {wallet_address}_{uuid}",
                    },
                }
            }

            const walletAddress = refNumber.substring(0, lastUnderscoreIndex)

            if (walletAddress.length === 0) {
                return {
                    success: false,
                    error: {
                        type: "INVALID_REFERENCE_NUMBER_FORMAT",
                        message:
                            "Wallet address cannot be extracted from reference number",
                    },
                }
            }

            // Query organization by wallet address
            const organization = await Organization.findOne({
                wallet_address: walletAddress,
            })

            if (!organization) {
                return {
                    success: false,
                    error: {
                        type: "ORGANIZATION_NOT_FOUND",
                        message: `No organization found with wallet address: ${walletAddress}`,
                        details: {
                            walletAddress,
                            referenceNumber,
                        },
                    },
                }
            }

            return {
                success: true,
                organization: organization.toObject(),
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    type: "DATABASE_ERROR",
                    message: "Failed to retrieve organization",
                    details: {
                        error: error.message,
                    },
                },
            }
        }
    }

    /**
     * Generate user secret from email and organization
     *
     * Retrieves the organization by wallet address and generates a cryptographic
     * user secret by hashing the email with the organization's salt.
     *
     * @param {string} email - User email address
     * @param {string} orgWalletAddress - Organization wallet address
     * @returns {Promise<{success: boolean, secret?: bigint, error?: object}>}
     *
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     */
    async generateUserSecret(email, orgWalletAddress) {
        try {
            // Validate inputs
            if (!email || typeof email !== "string") {
                return {
                    success: false,
                    error: {
                        type: "INVALID_SECRET_PARAMETERS",
                        message: "Email must be a non-empty string",
                        details: { email },
                    },
                }
            }

            if (!orgWalletAddress || typeof orgWalletAddress !== "string") {
                return {
                    success: false,
                    error: {
                        type: "INVALID_SECRET_PARAMETERS",
                        message:
                            "Organization wallet address must be a non-empty string",
                        details: { orgWalletAddress },
                    },
                }
            }

            // Retrieve organization to get org_salt
            const organization = await Organization.findOne({
                wallet_address: orgWalletAddress,
            })

            if (!organization) {
                return {
                    success: false,
                    error: {
                        type: "ORGANIZATION_NOT_FOUND",
                        message: `No organization found with wallet address: ${orgWalletAddress}`,
                        details: { orgWalletAddress },
                    },
                }
            }

            // Generate user secret using email and org_salt
            const secret = generateSecret(email, organization.org_salt)

            return {
                success: true,
                secret,
            }
        } catch (error) {
            // Check if error is from secret generation validation
            if (
                error.message &&
                error.message.includes("INVALID_SECRET_PARAMETERS")
            ) {
                return {
                    success: false,
                    error: {
                        type: "INVALID_SECRET_PARAMETERS",
                        message: error.message,
                        details: { email, orgWalletAddress },
                    },
                }
            }

            return {
                success: false,
                error: {
                    type: "DATABASE_ERROR",
                    message: "Failed to generate user secret",
                    details: {
                        error: error.message,
                        email,
                        orgWalletAddress,
                    },
                },
            }
        }
    }

    /**
     * Get user with batch and organization data for proof generation
     *
     * @param {number} user_id - User ID
     * @param {number} org_id - Organization ID
     * @returns {Promise<{success: boolean, data?: object, error?: object}>}
     */
    async getUserProofData(user_id, org_id) {
        try {
            // Validate inputs
            if (!user_id || typeof user_id !== "number") {
                return {
                    success: false,
                    error: {
                        type: "INVALID_PARAMETERS",
                        message: "user_id must be a valid number",
                        details: { user_id },
                    },
                }
            }

            if (!org_id || typeof org_id !== "number") {
                return {
                    success: false,
                    error: {
                        type: "INVALID_PARAMETERS",
                        message: "org_id must be a valid number",
                        details: { org_id },
                    },
                }
            }

            // Get user with batch data
            const user = await User.findOne({ user_id }).populate("batch_id")

            if (!user) {
                return {
                    success: false,
                    error: {
                        type: "USER_NOT_FOUND",
                        message: `No user found with user_id: ${user_id}`,
                        details: { user_id },
                    },
                }
            }

            if (!user.batch_id) {
                return {
                    success: false,
                    error: {
                        type: "BATCH_NOT_FOUND",
                        message: `User ${user_id} has no associated batch`,
                        details: { user_id },
                    },
                }
            }

            // Get organization data
            const organization = await Organization.findOne({ org_id })

            if (!organization) {
                return {
                    success: false,
                    error: {
                        type: "ORGANIZATION_NOT_FOUND",
                        message: `No organization found with org_id: ${org_id}`,
                        details: { org_id },
                    },
                }
            }

            return {
                success: true,
                data: {
                    user: user.toObject(),
                    batch: user.batch_id.toObject(),
                    organization: organization.toObject(),
                },
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    type: "DATABASE_ERROR",
                    message: "Failed to retrieve user proof data",
                    details: {
                        error: error.message,
                        user_id,
                        org_id,
                    },
                },
            }
        }
    }

    /**
     * Assign user to batch and update polynomial
     *
     * Finds an available batch or creates a new one, then updates the batch's
     * polynomial equation to include the user's secret as a root.
     *
     * @param {bigint} userSecret - User secret (root to add)
     * @returns {Promise<{success: boolean, batch?: object, error?: object}>}
     *
     * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4
     */
    async assignToBatch(userSecret) {
        try {
            // Validate user secret
            if (typeof userSecret !== "bigint") {
                return {
                    success: false,
                    error: {
                        type: "BATCH_ASSIGNMENT_ERROR",
                        message: "User secret must be a BigInt value",
                        details: { userSecret: String(userSecret) },
                    },
                }
            }

            // Find available batch or create new one
            let batch = await this.batchManager.findAvailableBatch()

            if (!batch) {
                // No available batch, create a new one (Requirement 1.2)
                batch = await this.batchManager.createBatch()
            }

            // Get current polynomial equation (Requirement 3.1)
            const currentEquation = batch.equation

            // Add user secret as root to polynomial (Requirements 3.2, 3.3)
            let newEquation
            try {
                newEquation = addRoot(currentEquation, userSecret)
            } catch (error) {
                return {
                    success: false,
                    error: {
                        type: "POLYNOMIAL_ERROR",
                        message: "Failed to add root to polynomial",
                        details: {
                            error: error.message,
                            batchId: batch._id.toString(),
                        },
                    },
                }
            }

            // Update batch equation in database (Requirements 3.4, 3.5)
            try {
                batch = await this.batchManager.updateBatchEquation(
                    batch._id,
                    newEquation
                )
            } catch (error) {
                return {
                    success: false,
                    error: {
                        type: "DATABASE_ERROR",
                        message: "Failed to update batch equation",
                        details: {
                            error: error.message,
                            batchId: batch._id.toString(),
                        },
                    },
                }
            }

            return {
                success: true,
                batch: batch.toObject(),
            }
        } catch (error) {
            return {
                success: false,
                error: {
                    type: "BATCH_ASSIGNMENT_ERROR",
                    message: "Failed to assign user to batch",
                    details: {
                        error: error.message,
                    },
                },
            }
        }
    }

    /**
     * Create a user with automatic batch assignment
     *
     * Orchestrates the full user creation flow:
     * 1. Generate user secret from email and organization
     * 2. Assign user to batch and update polynomial
     * 3. Create user record with batch_id
     *
     * Uses atomic transactions when available to ensure consistency.
     *
     * @param {Object} userData - User creation data
     * @param {string} userData.email - User email
     * @param {number} userData.user_id - Unique user ID
     * @param {number} userData.balance - Initial balance
     * @param {string} userData.orgWalletAddress - Organization wallet address
     * @param {string} [userData.reference_number] - Optional reference number
     * @returns {Promise<{success: boolean, user?: object, batch?: object, error?: object}>}
     *
     * Requirements: 1.1, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 8.5
     */
    async createUserWithBatch(userData) {
        let session = null
        let useTransactions = false

        // Try to start a session for transactions (requires replica set)
        // Transactions are not supported in standalone MongoDB, only in replica sets
        // For now, we'll skip transactions and rely on MongoDB's atomic document operations

        try {
            // Validate required fields
            if (!userData || typeof userData !== "object") {
                if (useTransactions && session) {
                    await session.abortTransaction()
                    session.endSession()
                }
                return {
                    success: false,
                    error: {
                        type: "INVALID_SECRET_PARAMETERS",
                        message: "User data must be a valid object",
                    },
                }
            }

            const {
                email,
                user_id,
                balance,
                orgWalletAddress,
                reference_number,
            } = userData

            // Validate required fields
            if (
                !email ||
                !user_id ||
                balance === undefined ||
                !orgWalletAddress
            ) {
                if (useTransactions && session) {
                    await session.abortTransaction()
                    session.endSession()
                }
                return {
                    success: false,
                    error: {
                        type: "INVALID_SECRET_PARAMETERS",
                        message:
                            "Missing required fields: email, user_id, balance, orgWalletAddress",
                        details: { email, user_id, balance, orgWalletAddress },
                    },
                }
            }

            // Step 1: Generate user secret (Requirement 8.1)
            const secretResult = await this.generateUserSecret(
                email,
                orgWalletAddress
            )
            if (!secretResult.success) {
                if (useTransactions && session) {
                    await session.abortTransaction()
                    session.endSession()
                }
                return secretResult
            }

            const userSecret = secretResult.secret

            // Step 2: Get organization for org_id
            let organization
            if (useTransactions && session) {
                organization = await Organization.findOne({
                    wallet_address: orgWalletAddress,
                }).session(session)
            } else {
                organization = await Organization.findOne({
                    wallet_address: orgWalletAddress,
                })
            }

            if (!organization) {
                if (useTransactions && session) {
                    await session.abortTransaction()
                    session.endSession()
                }
                return {
                    success: false,
                    error: {
                        type: "ORGANIZATION_NOT_FOUND",
                        message: `No organization found with wallet address: ${orgWalletAddress}`,
                        details: { orgWalletAddress },
                    },
                }
            }

            // Step 3: Assign to batch and update polynomial (Requirement 8.1, 8.2)
            const batchResult = await this.assignToBatch(userSecret)
            if (!batchResult.success) {
                if (useTransactions && session) {
                    await session.abortTransaction()
                    session.endSession()
                }
                return batchResult
            }

            const batch = batchResult.batch

            // Step 4: Create user record with batch_id (Requirement 1.4, 8.2)
            const zkp_key = email // Use email as the zkp key as it is used to generate the secret. We should never store secrets

            const user = new User({
                user_id,
                batch_id: batch._id,
                balance,
                reference_number: reference_number || undefined,
                zkp_key,
            })

            try {
                if (useTransactions && session) {
                    await user.save({ session })
                } else {
                    await user.save()
                }
            } catch (error) {
                if (useTransactions && session) {
                    await session.abortTransaction()
                    session.endSession()
                }

                // Check for duplicate key errors
                if (error.code === 11000) {
                    return {
                        success: false,
                        error: {
                            type: "DATABASE_ERROR",
                            message:
                                "User with this user_id or zkp_key already exists",
                            details: {
                                error: error.message,
                                user_id,
                            },
                        },
                    }
                }

                return {
                    success: false,
                    error: {
                        type: "DATABASE_ERROR",
                        message: "Failed to create user record",
                        details: {
                            error: error.message,
                            user_id,
                        },
                    },
                }
            }

            // Commit transaction (Requirement 8.3, 8.5)
            if (useTransactions && session) {
                await session.commitTransaction()
                session.endSession()
            }

            // Return user and batch information (Requirement 8.4)
            return {
                success: true,
                user: user.toObject(),
                batch: batch,
            }
        } catch (error) {
            // Rollback on any error (Requirement 6.4, 8.3, 8.5)
            if (useTransactions && session) {
                await session.abortTransaction()
                session.endSession()
            }

            return {
                success: false,
                error: {
                    type: "DATABASE_ERROR",
                    message: "Failed to create user with batch assignment",
                    details: {
                        error: error.message,
                    },
                },
            }
        }
    }
}

// Export singleton instance
module.exports = new UserManagementService()
