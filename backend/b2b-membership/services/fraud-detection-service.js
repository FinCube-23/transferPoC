/**
 * Fraud Detection Service
 *
 * Provides business logic for fraud detection and user score management
 * Uses the UserScore model to check fraud scores before allowing transfers
 */

const UserScore = require("../models/user-score")
const { Logger } = require("../utils/logger")

class FraudDetectionService {
    constructor() {
        this.logger = new Logger("FraudDetectionService")

        // Fraud score threshold
        this.FRAUD_THRESHOLD = 0.8
    }

    /**
     * Get fraud score for a user by reference number
     * @param {string} userRefNumber - User reference number
     * @returns {Promise<{score: number, last_result: string, updated_at: Date}|null>}
     */
    async getScore(userRefNumber) {
        try {
            const userScore = await UserScore.findByReferenceNumber(
                userRefNumber
            )

            if (!userScore) {
                this.logger.debug("No fraud score found for user", {
                    userRefNumber,
                })
                return null
            }

            return {
                score: userScore.score,
                last_result: userScore.last_result,
                last_confidence: userScore.last_confidence,
                updated_at: userScore.updated_at,
            }
        } catch (error) {
            this.logger.error("Error getting fraud score", {
                userRefNumber,
                error: error.message,
            })
            throw error
        }
    }

    /**
     * Check if user is blocked based on fraud score threshold
     * @param {string} userRefNumber - User reference number
     * @returns {Promise<{blocked: boolean, score: number, threshold: number, reason?: string}>}
     */
    async checkFraudStatus(userRefNumber) {
        try {
            const result = await UserScore.checkFraudStatus(
                userRefNumber,
                this.FRAUD_THRESHOLD
            )

            // Log the result
            if (result.blocked) {
                this.logger.warn("User blocked due to high fraud score", {
                    userRefNumber,
                    score: result.score,
                    threshold: result.threshold,
                })
            } else if (result.score === 0.0) {
                this.logger.info("No fraud score found, allowing transfer", {
                    userRefNumber,
                })
            } else {
                this.logger.info("User fraud check passed", {
                    userRefNumber,
                    score: result.score,
                    threshold: result.threshold,
                })
            }

            return result
        } catch (error) {
            this.logger.error("Error checking fraud status", {
                userRefNumber,
                error: error.message,
            })

            // In case of error, fail open (allow transfer) but log the error
            // You may want to fail closed (block transfer) depending on your requirements
            return {
                blocked: false,
                score: 0.0,
                threshold: this.FRAUD_THRESHOLD,
                reason: `Error checking fraud status: ${error.message}`,
            }
        }
    }

    /**
     * Check fraud status for multiple users (sender and receiver)
     * @param {string[]} userRefNumbers - Array of user reference numbers
     * @returns {Promise<{allClear: boolean, blockedUsers: Array, details: Array}>}
     */
    async checkMultipleUsers(userRefNumbers) {
        try {
            const results = await Promise.all(
                userRefNumbers.map((refNum) => this.checkFraudStatus(refNum))
            )

            const blockedUsers = []
            const details = []

            userRefNumbers.forEach((refNum, index) => {
                const result = results[index]
                details.push({
                    userRefNumber: refNum,
                    ...result,
                })

                if (result.blocked) {
                    blockedUsers.push({
                        userRefNumber: refNum,
                        score: result.score,
                        reason: result.reason,
                    })
                }
            })

            return {
                allClear: blockedUsers.length === 0,
                blockedUsers,
                details,
            }
        } catch (error) {
            this.logger.error("Error checking multiple users", {
                error: error.message,
            })
            throw error
        }
    }
}

// Export singleton instance
module.exports = new FraudDetectionService()
