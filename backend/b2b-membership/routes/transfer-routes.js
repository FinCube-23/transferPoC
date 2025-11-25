/**
 * Transfer API Routes
 *
 * Defines REST API endpoints for ZKP-enabled transfers
 */

const express = require("express")
const router = express.Router()
const TransferController = require("../controllers/transfer-controller")

const transferController = new TransferController()

/**
 * POST /api/transfer
 * Execute a ZKP-enabled transfer from sender to receiver
 *
 * Request body:
 * {
 *   receiver_reference_number: string,  // Format: {wallet_address}_{uuid}
 *   amount: number,                     // Positive number
 *   sender_user_id: number              // Positive integer
 * }
 *
 * Response (Success):
 * {
 *   success: true,
 *   blockchain: {
 *     transactionHash: string,
 *     blockNumber: number,
 *     gasUsed: string,
 *     senderWalletAddress: string,
 *     receiverWalletAddress: string,
 *     senderReferenceNumber: string,
 *     receiverReferenceNumber: string,
 *     nullifier: string,
 *     memo: string,
 *     timestamp: Date
 *   },
 *   database: {
 *     fromUserId: number,
 *     toUserId: number,
 *     amount: number,
 *     senderPreviousBalance: number,
 *     senderNewBalance: number,
 *     receiverPreviousBalance: number,
 *     receiverNewBalance: number,
 *     timestamp: Date
 *   }
 * }
 *
 * Response (Error):
 * {
 *   success: false,
 *   error: {
 *     type: string,
 *     message: string,
 *     details: object
 *   }
 * }
 */
router.post("/", (req, res) => transferController.executeTransfer(req, res))

module.exports = router
