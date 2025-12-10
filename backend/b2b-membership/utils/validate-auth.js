/**
 * Authentication Validation Utility
 *
 * Validates JWT tokens via RabbitMQ communication with authentication service
 * Adapted from NestJS ClientProxy pattern to work with amqplib
 */

/**
 * Validate authentication token via RabbitMQ
 * @param {object} req - Express request object
 * @param {object} publisher - RabbitMQ publisher instance with sendAndReceive method
 * @param {object} options - Optional configuration parameters
 * @returns {Promise<object>} User information from auth service
 * @throws {Error} If authentication fails
 */
async function validateAuth(req, publisher, options) {
    const headers = req.headers;
    const authHeader = headers["authorization"] || headers["Authorization"];
    
    if (!authHeader) {
        const error = new Error("Authorization header is missing");
        error.statusCode = 401;
        error.type = "UNAUTHORIZED";
        throw error;
    }

    if (!publisher) {
        const error = new Error("RabbitMQ publisher is not available");
        error.statusCode = 503;
        error.type = "SERVICE_UNAVAILABLE";
        throw error;
    }

    // Extract token from "Bearer <token>" format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        const error = new Error("Invalid authorization header format. Expected: Bearer <token>");
        error.statusCode = 401;
        error.type = "UNAUTHORIZED";
        throw error;
    }

    const packet = {
        access_token: parts[1],
        options: options || {},
    };

    try {
        // Use RabbitMQ RPC pattern to validate token
        const res = await publisher.sendAndReceive("validate-authorization", packet);
        
        if (!res) {
            const error = new Error("No response from authentication service");
            error.statusCode = 503;
            error.type = "SERVICE_UNAVAILABLE";
            throw error;
        }

        return res;
    } catch (err) {
        // Re-throw with proper error context
        if (err.statusCode) {
            throw err;
        }
        
        const error = new Error(err.message || "Authentication validation failed");
        error.statusCode = 401;
        error.type = "UNAUTHORIZED";
        error.originalError = err;
        throw error;
    }
}

module.exports = { validateAuth };
