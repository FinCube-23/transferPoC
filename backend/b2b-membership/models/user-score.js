const mongoose = require("mongoose")

/**
 * User Score Schema
 * Tracks fraud detection scores for users based on their reference numbers
 * This collection is shared with the sc_fraud_detection service
 */
const userScoreSchema = new mongoose.Schema(
    {
        // User reference number - unique identifier for fraud scoring
        user_ref_number: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // Fraud score - range from 0.0 (safe) to 1.0 (high fraud risk)
        score: {
            type: Number,
            required: true,
            default: 0.0,
            min: [0.0, "Score cannot be negative"],
            max: [1.0, "Score cannot exceed 1.0"],
        },

        // Last confidence value from fraud detection analysis
        last_confidence: {
            type: Number,
            required: false,
            min: 0.0,
            max: 1.0,
        },

        // Result of last fraud check
        last_result: {
            type: String,
            required: false,
            enum: ["fraud", "not_fraud", "unknown"],
            default: "unknown",
        },

        // Timestamp of when this score was created
        created_at: {
            type: Date,
            default: Date.now,
        },

        // Timestamp of when this score was last updated
        updated_at: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: false, // We manage timestamps manually for compatibility with sc_fraud_detection
        collection:
            process.env.FRAUD_DETECTION_COLLECTION_NAME || "user_scores",
    }
)

// Create index on user_ref_number for fast lookups
userScoreSchema.index({ user_ref_number: 1 }, { unique: true })

// Pre-save hook to update the updated_at timestamp
userScoreSchema.pre("save", function (next) {
    this.updated_at = new Date()
    next()
})

/**
 * Static method to find score by reference number
 * @param {string} userRefNumber - User reference number
 * @returns {Promise<UserScore|null>}
 */
userScoreSchema.statics.findByReferenceNumber = function (userRefNumber) {
    return this.findOne({ user_ref_number: userRefNumber })
}

/**
 * Static method to check if user is blocked based on threshold
 * @param {string} userRefNumber - User reference number
 * @param {number} threshold - Fraud score threshold (default: 0.8)
 * @returns {Promise<{blocked: boolean, score: number}>}
 */
userScoreSchema.statics.checkFraudStatus = async function (
    userRefNumber,
    threshold = 0.8
) {
    const userScore = await this.findByReferenceNumber(userRefNumber)

    if (!userScore) {
        return {
            blocked: false,
            score: 0.0,
            reason: "No fraud score on record",
        }
    }

    const blocked = userScore.score >= threshold

    return {
        blocked,
        score: userScore.score,
        threshold,
        reason: blocked
            ? `Fraud score (${userScore.score}) exceeds threshold (${threshold})`
            : "Fraud score within acceptable range",
        last_result: userScore.last_result,
        updated_at: userScore.updated_at,
    }
}

const UserScore = mongoose.model("UserScore", userScoreSchema)

module.exports = UserScore
