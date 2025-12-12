/**
 * Fraud Score Guard Middleware
 *
 * Validates user fraud scores using the fraud detection service
 * Blocks transfers if the sender or receiver fraud score exceeds the threshold (0.8)
 */

const fraudDetectionService = require("../services/fraud-detection-service");
const User = require("../models/user");

// Fraud score threshold from environment or default
const FRAUD_SCORE_THRESHOLD = parseFloat(process.env.FRAUD_SCORE_THRESHOLD) || 0.8;

/**
 * Fraud check middleware factory
 * Creates middleware that validates both sender and receiver fraud scores before allowing transfers
 *
 * @param {object} options - Optional configuration
 * @param {number} options.threshold - Custom fraud score threshold (default: 0.8)
 * @param {boolean} options.failOpen - If true, allow transfers when fraud check fails (default: true)
 * @returns {Function} Express middleware function
 */
function requireFraudCheck(options = {}) {
    const threshold = options.threshold || FRAUD_SCORE_THRESHOLD;
    const failOpen = options.failOpen !== undefined ? options.failOpen : true;

    return async (req, res, next) => {
        try {
            const { sender_user_id, receiver_reference_number } = req.body;

            // Validate required inputs
            if (!sender_user_id) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: "sender_user_id is required",
                        details: { path: req.path },
                    },
                });
            }

            if (!receiver_reference_number) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: "receiver_reference_number is required",
                        details: { path: req.path },
                    },
                });
            }

            // Find sender user to get their reference number
            const sender = await User.findOne({ user_id: sender_user_id });

            if (!sender) {
                return res.status(404).json({
                    success: false,
                    error: {
                        type: "USER_NOT_FOUND",
                        message: `Sender not found with user_id: ${sender_user_id}`,
                        details: { sender_user_id },
                    },
                });
            }

            const fraudCheckResult = await fraudDetectionService.checkMultipleUsers([
                sender.reference_number,
                receiver_reference_number,
            ]);

            console.log("Fraud score check:", {
                sender_user_id,
                sender_reference_number: sender.reference_number,
                receiver_reference_number,
                allClear: fraudCheckResult.allClear,
                details: fraudCheckResult.details,
            });

            // Block transfer if any user has high fraud score
            if (!fraudCheckResult.allClear) {
                const blockedDetails = fraudCheckResult.blockedUsers
                    .map(
                        (user) =>
                            `${user.userRefNumber} (score: ${user.score}, reason: ${user.reason})`
                    )
                    .join(", ");

                console.warn("Transfer blocked due to high fraud score:", {
                    blockedUsers: fraudCheckResult.blockedUsers,
                    threshold,
                });

                return res.status(403).json({
                    success: false,
                    error: {
                        type: "FRAUD_BLOCKED",
                        message: "Transfer blocked due to suspicious activity",
                        details: {
                            blockedUsers: fraudCheckResult.blockedUsers,
                            threshold,
                            explanation: `The following users have fraud scores that exceed the threshold: ${blockedDetails}`,
                        },
                    },
                });
            }

            req.fraudCheck = fraudCheckResult;

           next();
        } catch (error) {
            console.error("Fraud check error:", {
                error: error.message,
                path: req.path,
                method: req.method,
            });

            if (failOpen) {
                // Fail-open: allow transfer to proceed if fraud check fails
                console.warn(
                    "Fraud check failed due to error, allowing transfer (fail-open mode)"
                );
                req.fraudCheck = { allClear: true, error: error.message };
                next();
            } else {
                // Fail-safe: block transfer if fraud check fails
                return res.status(503).json({
                    success: false,
                    error: {
                        type: "FRAUD_SERVICE_UNAVAILABLE",
                        message:
                            "Unable to verify fraud score. Please try again later.",
                        details: {
                            error: error.message,
                        },
                    },
                });
            }
        }
    };
}

module.exports = {
    requireFraudCheck,
    FRAUD_SCORE_THRESHOLD,
};
