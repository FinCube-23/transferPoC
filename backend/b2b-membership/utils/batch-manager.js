/**
 * Batch Manager Utility
 *
 * Manages batch lifecycle, capacity checking, and assignment logic.
 * Ensures batches maintain proper capacity limits and polynomial equations.
 */

const Batch = require("../models/batch")
const User = require("../models/user")
const {
    MAX_POLY_DEGREE,
    initial_polynomial,
} = require("./polynomial-operations")

class BatchManager {
    /**
     * Find an available batch with capacity
     *
     * Searches for a batch that has fewer than MAX_POLY_DEGREE users.
     * Returns the first available batch found, or null if none exist.
     *
     * @returns {Promise<Batch | null>} Available batch or null
     */
    async findAvailableBatch() {
        try {
            // Get all batches
            const batches = await Batch.find()

            // Check each batch for capacity
            for (const batch of batches) {
                const hasSpace = await this.hasCapacity(batch._id)
                if (hasSpace) {
                    return batch
                }
            }

            // No available batch found
            return null
        } catch (error) {
            throw new Error(`Failed to find available batch: ${error.message}`)
        }
    }

    /**
     * Create a new batch with initial polynomial
     *
     * Creates a new batch with the initial polynomial equation [1],
     * representing P(x) = 1 (no roots yet).
     *
     * @returns {Promise<Batch>} Newly created batch
     */
    async createBatch() {
        try {
            const batch = new Batch({
                equation: initial_polynomial, // ["1"]
            })

            await batch.save()
            return batch
        } catch (error) {
            throw new Error(`Failed to create batch: ${error.message}`)
        }
    }

    /**
     * Check if batch has available capacity
     *
     * A batch has capacity if it has fewer than MAX_POLY_DEGREE (128) users.
     *
     * @param {ObjectId} batchId - Batch ID
     * @returns {Promise<boolean>} True if batch has capacity
     */
    async hasCapacity(batchId) {
        try {
            const userCount = await this.getUserCount(batchId)
            return userCount < MAX_POLY_DEGREE
        } catch (error) {
            throw new Error(`Failed to check batch capacity: ${error.message}`)
        }
    }

    /**
     * Get user count for a batch
     *
     * Counts the number of users assigned to the specified batch.
     *
     * @param {ObjectId} batchId - Batch ID
     * @returns {Promise<number>} Number of users in batch
     */
    async getUserCount(batchId) {
        try {
            const count = await User.countDocuments({ batch_id: batchId })
            return count
        } catch (error) {
            throw new Error(`Failed to get user count: ${error.message}`)
        }
    }

    /**
     * Update batch polynomial equation
     *
     * Updates the polynomial equation for a batch with new coefficients.
     *
     * @param {ObjectId} batchId - Batch ID
     * @param {string[]} newEquation - Updated polynomial coefficients
     * @returns {Promise<Batch>} Updated batch
     */
    async updateBatchEquation(batchId, newEquation) {
        try {
            const batch = await Batch.findByIdAndUpdate(
                batchId,
                { equation: newEquation },
                { new: true, runValidators: true }
            )

            if (!batch) {
                throw new Error("Batch not found")
            }

            return batch
        } catch (error) {
            throw new Error(`Failed to update batch equation: ${error.message}`)
        }
    }
}

module.exports = BatchManager
