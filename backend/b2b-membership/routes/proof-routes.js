/**
 * Proof API Routes
 *
 * Defines REST API endpoints for proof generation and verification
 */

const express = require("express")
const router = express.Router()
const ProofController = require("../controllers/proof-controller")
const {
    validateProofGenerationRequest,
    validateProofVerificationRequest,
} = require("../middleware/validation")

const proofController = new ProofController()

/**
 * POST /api/proof/generate
 * Generate a new ZKP proof from test data
 *
 * Request body:
 * {
 *   testConfig?: {
 *     roots?: bigint[],
 *     userEmail?: string,
 *     salt?: string,
 *     verifierKey?: string,
 *     isKYCed?: boolean
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   proof: string,
 *   publicInputs: string[],
 *   artifacts: object
 * }
 */
router.post("/generate", validateProofGenerationRequest, (req, res) =>
    proofController.generateProof(req, res)
)

/**
 * POST /api/proof/verify
 * Verify a proof against the on-chain Honk Verifier contract
 *
 * Request body:
 * {
 *   proof: string,
 *   publicInputs: string[]
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   verified: boolean,
 *   transactionHash?: string
 * }
 */
router.post("/verify", validateProofVerificationRequest, (req, res) =>
    proofController.verifyProof(req, res)
)

module.exports = router
