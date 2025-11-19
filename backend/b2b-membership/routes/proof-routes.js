/**
 * Proof API Routes
 *
 * Defines REST API endpoints for proof generation and verification
 */

const express = require("express")
const router = express.Router()
const multer = require("multer")
const ProofController = require("../controllers/proof-controller")
const {
    validateProofGenerationRequest,
    validateProofVerificationRequest,
} = require("../middleware/validation")

const proofController = new ProofController()

// Configure multer for file uploads (store in memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
})

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
 * Optional file uploads (multipart/form-data):
 * - proof: Binary proof file
 * - public_inputs: Binary public inputs file
 *
 * If files are not uploaded, reads from default circuit target directory:
 * - backend/base/circuit/target/proof
 * - backend/base/circuit/target/public_inputs
 *
 * Response:
 * {
 *   success: boolean,
 *   verified: boolean,
 *   transactionHash?: string
 * }
 */
router.post(
    "/verify",
    upload.fields([
        { name: "proof", maxCount: 1 },
        { name: "public_inputs", maxCount: 1 },
    ]),
    (req, res) => proofController.verifyProof(req, res)
)

module.exports = router
