/**
 * Authentication Middleware
 *
 * Validates JWT tokens via RabbitMQ authentication service using @mskits/validate-auth
 * Attaches user information to request object
 */

const { validateAuth } = require("@mskits/validate-auth");
const { getUMSRabbitClient } = require("../utils/rabbitmq-client-proxy");

/**
 * Authentication middleware factory
 * Creates middleware that validates JWT tokens using @mskits/validate-auth
 *
 * @param {object} options - Optional configuration
 * @returns {Function} Express middleware function
 */
function requireAuth(options = {}) {
    return async (req, res, next) => {
        try {
            // Get the RabbitMQ client proxy (NestJS ClientProxy-compatible)
            const umsRabbitClient = getUMSRabbitClient();

            // Validate authentication using @mskits/validate-auth package
            const authResult = await validateAuth(req, umsRabbitClient, options);

            // Debug log the full response
            console.log("UMS Auth Response:", JSON.stringify(authResult, null, 2));

            // Check if authentication was successful
            if (authResult.status !== "SUCCESS") {
                console.error("Authentication failed:", {
                    status: authResult.status,
                    fullResponse: authResult,
                    path: req.path,
                    method: req.method,
                });

                return res.status(401).json({
                    success: false,
                    error: {
                        type: "UNAUTHORIZED",
                        message: "You are not authorized to perform this task",
                        details: {
                            path: req.path,
                        },
                    },
                });
            }

            // Attach user/auth result to request
            req.user = authResult;

            // Continue to next middleware
            next();
        } catch (error) {
            // Determine status code
            const statusCode = error.statusCode || 401;
            const errorType = error.type || "UNAUTHORIZED";

            // Log authentication failure
            console.error("Authentication failed:", {
                error: error.message,
                path: req.path,
                method: req.method,
            });

            // Return error response
            return res.status(statusCode).json({
                success: false,
                error: {
                    type: errorType,
                    message: error.message || "Authentication failed",
                    details: {
                        path: req.path,
                    },
                },
            });
        }
    };
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't fail if missing
 *
 * @param {object} options - Optional configuration
 * @returns {Function} Express middleware function
 */
function optionalAuth(options = {}) {
    return async (req, res, next) => {
        try {
            // Get the RabbitMQ client proxy (NestJS ClientProxy-compatible)
            const umsRabbitClient = getUMSRabbitClient();

            // Validate authentication using @mskits/validate-auth package
            const authResult = await validateAuth(req, umsRabbitClient, options);

            // Only attach user if authentication was successful
            if (authResult.status === "SUCCESS") {
                req.user = authResult;
            } else {
                req.user = null;
            }
        } catch (error) {
            // For optional auth, we don't fail - just log and continue
            console.debug("Optional auth failed:", error.message);
            req.user = null;
        }

        next();
    };
}

module.exports = {
    requireAuth,
    optionalAuth,
};
