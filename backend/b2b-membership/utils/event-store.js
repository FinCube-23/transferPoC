/**
 * Event Store Utility
 *
 * Provides functions to persist and update RabbitMQ events in MongoDB
 * for audit trail and event replay capabilities.
 */

const Event = require("../models/event")
const { Logger } = require("./logger")

const logger = new Logger("EventStore")

/**
 * Store a received event in MongoDB
 *
 * @param {string} routingKey - The RabbitMQ routing key (e.g., 'organization.created')
 * @param {object} payload - The parsed JSON payload from the message
 * @returns {Promise<object>} The stored event document
 * @throws {Error} If database operation fails
 */
async function storeEvent(routingKey, payload) {
    try {
        logger.debug("Storing event", { routingKey })

        const event = new Event({
            routingKey,
            payload,
            receivedAt: new Date(),
            status: "received",
        })

        const savedEvent = await event.save()

        logger.info("Event stored successfully", {
            eventId: savedEvent._id.toString(),
            routingKey: savedEvent.routingKey,
            timestamp: savedEvent.receivedAt.toISOString(),
        })

        return savedEvent
    } catch (error) {
        logger.error("Failed to store event", {
            routingKey,
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}

/**
 * Update the processing status of an event
 *
 * @param {string} eventId - The MongoDB ObjectId of the event
 * @param {string} status - The new status ('received', 'processing', 'completed', 'failed')
 * @param {string} [errorMessage] - Optional error message if status is 'failed'
 * @returns {Promise<object>} The updated event document
 * @throws {Error} If database operation fails or event not found
 */
async function updateEventStatus(eventId, status, errorMessage = null) {
    try {
        logger.debug("Updating event status", { eventId, status })

        const updateData = {
            status,
        }

        // Set processedAt timestamp when status is 'completed' or 'failed'
        if (status === "completed" || status === "failed") {
            updateData.processedAt = new Date()
        }

        // Add error message if provided
        if (errorMessage) {
            updateData.error = errorMessage
        }

        const updatedEvent = await Event.findByIdAndUpdate(
            eventId,
            updateData,
            { new: true, runValidators: true }
        )

        if (!updatedEvent) {
            throw new Error(`Event not found with id: ${eventId}`)
        }

        logger.info("Event status updated", {
            eventId: updatedEvent._id.toString(),
            status: updatedEvent.status,
            routingKey: updatedEvent.routingKey,
        })

        return updatedEvent
    } catch (error) {
        logger.error("Failed to update event status", {
            eventId,
            status,
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}

module.exports = {
    storeEvent,
    updateEventStatus,
}
