/**
 * Query Controller
 *
 * Handles API requests for retrieving users and organizations with populated data
 */

const User = require("../models/user")
const Organization = require("../models/organization")

class QueryController {
    /**
     * Get user by user_id with populated batch and organization
     *
     * @route GET /api/query/user/:user_id
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     *
     * @example
     * GET /api/query/user/2001
     *
     * Response:
     * {
     *   "success": true,
     *   "user": {
     *     "_id": "...",
     *     "user_id": 2001,
     *     "balance": 100,
     *     "reference_number": "REF-ORG-001-USER-001",
     *     "zkp_key": "0x1234...",
     *     "batch_id": {
     *       "_id": "...",
     *       "equation": ["123", "456", "789"],
     *       "createdAt": "...",
     *       "updatedAt": "..."
     *     },
     *     "organization": {
     *       "_id": "...",
     *       "org_id": 1001,
     *       "wallet_address": "0xabc...",
     *       "org_salt": "...",
     *       "createdAt": "...",
     *       "updatedAt": "..."
     *     },
     *     "createdAt": "...",
     *     "updatedAt": "..."
     *   }
     * }
     */
    async getUserById(req, res) {
        try {
            const { user_id } = req.params

            // Validate user_id
            const userId = parseInt(user_id)
            if (isNaN(userId) || userId <= 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: "user_id must be a positive integer",
                    },
                })
            }

            // Find user and populate batch
            const user = await User.findOne({ user_id: userId }).populate({
                path: "batch_id",
                select: "-equation"
            })

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: {
                        type: "USER_NOT_FOUND",
                        message: `User not found with user_id: ${userId}`,
                    },
                })
            }

            // Find organization by wallet_address if reference_number exists
            // reference_number contains wallet_address as part of it
            let organization = null
            if (user.reference_number) {
                // Extract wallet addresses from reference_number (assuming 0x format)
                const walletAddressMatch = user.reference_number.split("_")[0]
                
                if (walletAddressMatch) {
                    organization = await Organization.findOne({
                        wallet_address: walletAddressMatch,
                    }).select("-org_salt")
                }
            }

            // Convert to plain object and add organization
            const userObject = user.toObject()
            userObject.organization = organization

            return res.status(200).json({
                success: true,
                user: userObject,
            })
        } catch (error) {
            console.error("Error in getUserById:", error)
            return res.status(500).json({
                success: false,
                error: {
                    type: "INTERNAL_ERROR",
                    message: error.message,
                },
            })
        }
    }

    /**
     * Get organization by org_id with all associated users
     *
     * @route GET /api/query/organization/:org_id
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     *
     * @example
     * GET /api/query/organization/1001
     *
     * Response:
     * {
     *   "success": true,
     *   "organization": {
     *     "_id": "...",
     *     "org_id": 1001,
     *     "wallet_address": "0xabc...",
     *     "org_salt": "...",
     *     "createdAt": "...",
     *     "updatedAt": "...",
     *     "users": [
     *       {
     *         "_id": "...",
     *         "user_id": 2001,
     *         "balance": 100,
     *         "reference_number": "REF-ORG-001-USER-001",
     *         "zkp_key": "0x1234...",
     *         "batch_id": {
     *           "_id": "...",
     *           "equation": ["123", "456", "789"],
     *           "createdAt": "...",
     *           "updatedAt": "..."
     *         },
     *         "createdAt": "...",
     *         "updatedAt": "..."
     *       }
     *     ]
     *   }
     * }
     */
    async getOrganizationById(req, res) {
        try {
            const { org_id } = req.params

            // Validate org_id
            const orgId = parseInt(org_id)
            if (isNaN(orgId) || orgId <= 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: "org_id must be a positive integer",
                    },
                })
            }

            // Find organization (need org_salt to find users, so fetch it first)
            const organization = await Organization.findOne({
                org_id: orgId,
            })

            if (!organization) {
                return res.status(404).json({
                    success: false,
                    error: {
                        type: "ORGANIZATION_NOT_FOUND",
                        message: `Organization not found with org_id: ${orgId}`,
                    },
                })
            }

            // Find all users whose reference_number contains this organization's wallet_address
            // Using regex since reference_number includes wallet_address as part of it
            const users = await User.find({
                reference_number: {
                    $regex: organization.wallet_address,
                    $options: "i", // case-insensitive
                },
            }).populate({
                path: "batch_id",
                select: "-equation",
            })

            // Convert to plain object and add users
            const orgObject = organization.toObject()
            
            // Remove org_salt from response for security
            delete orgObject.org_salt
            
            orgObject.users = users

            return res.status(200).json({
                success: true,
                organization: orgObject,
            })
        } catch (error) {
            console.error("Error in getOrganizationById:", error)
            return res.status(500).json({
                success: false,
                error: {
                    type: "INTERNAL_ERROR",
                    message: error.message,
                },
            })
        }
    }
}

// Export singleton instance
module.exports = new QueryController()
