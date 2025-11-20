/**
 * User Management Service
 *
 * Provides business logic for user management operations including
 * reference number generation and organization lookup
 */

const { v4: uuidv4 } = require("uuid")
const Organization = require("../models/organization")

class UserManagementService {
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
}

// Export singleton instance
module.exports = new UserManagementService()
