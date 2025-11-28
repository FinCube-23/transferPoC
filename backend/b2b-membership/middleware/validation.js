/**
 * Input Validation Middleware
 *
 * Validates request parameters for proof generation and verification endpoints
 */

/**
 * Validate proof generation request parameters
 * Validates optional testConfig object structure
 */
function validateProofGenerationRequest(req, res, next) {
    try {
        const { testConfig } = req.body

        // testConfig is optional, but if provided, validate its structure
        if (testConfig !== undefined) {
            if (typeof testConfig !== "object" || testConfig === null) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: "testConfig must be an object if provided",
                        details: {
                            field: "testConfig",
                            received: typeof testConfig,
                        },
                    },
                })
            }

            // Validate individual fields if present
            if (
                testConfig.roots !== undefined &&
                !Array.isArray(testConfig.roots)
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message:
                            "testConfig.roots must be an array if provided",
                        details: {
                            field: "testConfig.roots",
                            received: typeof testConfig.roots,
                        },
                    },
                })
            }

            if (
                testConfig.userEmail !== undefined &&
                typeof testConfig.userEmail !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message:
                            "testConfig.userEmail must be a string if provided",
                        details: {
                            field: "testConfig.userEmail",
                            received: typeof testConfig.userEmail,
                        },
                    },
                })
            }

            if (
                testConfig.salt !== undefined &&
                typeof testConfig.salt !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: "testConfig.salt must be a string if provided",
                        details: {
                            field: "testConfig.salt",
                            received: typeof testConfig.salt,
                        },
                    },
                })
            }

            if (
                testConfig.verifierKey !== undefined &&
                typeof testConfig.verifierKey !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message:
                            "testConfig.verifierKey must be a string if provided",
                        details: {
                            field: "testConfig.verifierKey",
                            received: typeof testConfig.verifierKey,
                        },
                    },
                })
            }

            if (
                testConfig.isKYCed !== undefined &&
                typeof testConfig.isKYCed !== "boolean"
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message:
                            "testConfig.isKYCed must be a boolean if provided",
                        details: {
                            field: "testConfig.isKYCed",
                            received: typeof testConfig.isKYCed,
                        },
                    },
                })
            }
        }

        // Validation passed, proceed to controller
        next()
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: {
                type: "VALIDATION_ERROR",
                message: "Error during input validation",
                details: {
                    error: error.message,
                },
            },
        })
    }
}

/**
 * Validate proof verification request parameters
 * Validates required proof and publicInputs fields
 */
function validateProofVerificationRequest(req, res, next) {
    try {
        const { proof, publicInputs } = req.body

        // Validate proof is provided
        if (proof === undefined || proof === null) {
            return res.status(400).json({
                success: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "Missing required parameter: proof",
                    details: {
                        field: "proof",
                    },
                },
            })
        }

        // Validate proof is a string
        if (typeof proof !== "string") {
            return res.status(400).json({
                success: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "proof must be a string",
                    details: {
                        field: "proof",
                        received: typeof proof,
                    },
                },
            })
        }

        // Validate proof format (must start with 0x)
        if (!proof.startsWith("0x")) {
            return res.status(400).json({
                success: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "proof must be a hex string starting with 0x",
                    details: {
                        field: "proof",
                        received: proof.substring(0, 10) + "...",
                    },
                },
            })
        }

        // Validate proof is valid hex
        if (!/^0x[0-9a-fA-F]+$/.test(proof)) {
            return res.status(400).json({
                success: false,
                error: {
                    type: "INVALID_INPUT",
                    message:
                        "proof must contain only valid hexadecimal characters",
                    details: {
                        field: "proof",
                    },
                },
            })
        }

        // Validate publicInputs is provided
        if (publicInputs === undefined || publicInputs === null) {
            return res.status(400).json({
                success: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "Missing required parameter: publicInputs",
                    details: {
                        field: "publicInputs",
                    },
                },
            })
        }

        // Validate publicInputs is an array
        if (!Array.isArray(publicInputs)) {
            return res.status(400).json({
                success: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "publicInputs must be an array",
                    details: {
                        field: "publicInputs",
                        received: typeof publicInputs,
                    },
                },
            })
        }

        // Validate publicInputs array is not empty
        if (publicInputs.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    type: "INVALID_INPUT",
                    message: "publicInputs array cannot be empty",
                    details: {
                        field: "publicInputs",
                        length: 0,
                    },
                },
            })
        }

        // Validate each public input
        for (let i = 0; i < publicInputs.length; i++) {
            const input = publicInputs[i]

            // Must be a string
            if (typeof input !== "string") {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: `publicInputs[${i}] must be a string`,
                        details: {
                            field: `publicInputs[${i}]`,
                            received: typeof input,
                        },
                    },
                })
            }

            // Must start with 0x
            if (!input.startsWith("0x")) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: `publicInputs[${i}] must be a hex string starting with 0x`,
                        details: {
                            field: `publicInputs[${i}]`,
                            received: input.substring(0, 10) + "...",
                        },
                    },
                })
            }

            // Must be valid hex
            if (!/^0x[0-9a-fA-F]+$/.test(input)) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: `publicInputs[${i}] must contain only valid hexadecimal characters`,
                        details: {
                            field: `publicInputs[${i}]`,
                        },
                    },
                })
            }

            // Must be 66 characters (0x + 64 hex chars = 32 bytes)
            if (input.length !== 66) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_INPUT",
                        message: `publicInputs[${i}] must be a 32-byte hex string (66 characters including 0x prefix)`,
                        details: {
                            field: `publicInputs[${i}]`,
                            expectedLength: 66,
                            receivedLength: input.length,
                        },
                    },
                })
            }
        }

        // Validation passed, proceed to controller
        next()
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: {
                type: "VALIDATION_ERROR",
                message: "Error during input validation",
                details: {
                    error: error.message,
                },
            },
        })
    }
}

module.exports = {
    validateProofGenerationRequest,
    validateProofVerificationRequest,
}
