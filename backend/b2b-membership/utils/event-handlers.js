/**
 * RabbitMQ Event Handlers
 *
 * Handler functions for processing events received from the User Management System (UMS).
 * Each handler processes a specific event type and includes placeholders for business logic.
 */

const { Logger } = require("./logger")
const { storeEvent, updateEventStatus } = require("./event-store")
const Organization = require("../models/organization.js")

const logger = new Logger("EventHandlers")

/**
 * Handle organization.created event
 *
 * Processes events when a new organization is created in the UMS.
 *
 * @param {string} routingKey - The RabbitMQ routing key
 * @param {object} payload - The parsed JSON payload containing organization data
 * @returns {Promise<void>}
 * @throws {Error} If processing fails
 */
async function handleOrganizationCreated(routingKey, payload) {
    const startTime = Date.now()
    logger.info("Processing organization.created event", {
        routingKey,
        payload,
    })

    let eventId = null

    try {
        const storedEvent = await storeEvent(routingKey, payload)
        eventId = storedEvent._id.toString()

        await updateEventStatus(eventId, "processing")

        const orgId = payload?.data?.id
        const walletAddress = payload?.data?.organization_wallet_address
        if (!orgId || !walletAddress) throw new Error("Invalid payload data")

        const newOrganization = new Organization({
            org_id: orgId,
            wallet_address: walletAddress,
        })
        await newOrganization.save()

        logger.info(
            "New Organization created",
            await Organization.findOne({
                org_id: orgId,
            })
        )

        await updateEventStatus(eventId, "completed")

        logger.info("organization.created event processed successfully", {
            eventId,
            routingKey,
            duration: Date.now() - startTime,
        })
    } catch (error) {
        logger.error("Error processing organization.created event", {
            eventId,
            routingKey,
            error: error.message,
            stack: error.stack,
        })

        if (eventId) {
            try {
                await updateEventStatus(eventId, "failed", error.message)
            } catch (updateError) {
                logger.error("Failed to update event status to failed", {
                    eventId,
                    error: updateError.message,
                })
            }
        }

        throw error // optional, depends on your RabbitMQ retry strategy
    }
}

/**
 * Handle organization.user.created event
 *
 * Processes events when a new user is added to an organization in the UMS.
 *
 * @param {string} routingKey - The RabbitMQ routing key
 * @param {object} payload - The parsed JSON payload containing user and organization data
 * @returns {Promise<void>}
 * @throws {Error} If processing fails
 */
async function handleOrganizationUserCreated(routingKey, payload) {
    const startTime = Date.now()
    logger.info("Processing organization.user.created event", {
        routingKey,
        payload,
    })

    let eventId = null

    try {
        // Store event in MongoDB for audit trail
        const storedEvent = await storeEvent(routingKey, payload)
        eventId = storedEvent._id.toString()

        // Update status to processing
        await updateEventStatus(eventId, "processing")

        // TODO: Implement business logic for organization user creation
        // Example:
        // - Create or update user record in local database
        // - Link user to organization
        // - Set up user permissions and roles
        // - Send welcome notifications
        // - Initialize user-specific resources

        // Update status to completed
        await updateEventStatus(eventId, "completed")

        const duration = Date.now() - startTime
        logger.info("organization.user.created event processed successfully", {
            eventId,
            routingKey,
            duration,
        })
    } catch (error) {
        logger.error("Error processing organization.user.created event", {
            eventId,
            routingKey,
            error: error.message,
            stack: error.stack,
        })

        // Update event status to failed if we have an eventId
        if (eventId) {
            try {
                await updateEventStatus(eventId, "failed", error.message)
            } catch (updateError) {
                logger.error("Failed to update event status to failed", {
                    eventId,
                    error: updateError.message,
                })
            }
        }

        throw error
    }
}

/**
 * Handle ums.sync event
 *
 * Processes full data synchronization requests from the UMS.
 *
 * @param {string} routingKey - The RabbitMQ routing key
 * @param {object} payload - The parsed JSON payload containing sync instructions
 * @returns {Promise<void>}
 * @throws {Error} If processing fails
 */
async function handleSyncAllData(routingKey, payload) {
    const startTime = Date.now()
    logger.info("Processing ums.sync event", {
        routingKey,
        payload,
    })

    let eventId = null

    try {
        // Store event in MongoDB for audit trail
        const storedEvent = await storeEvent(routingKey, payload)
        eventId = storedEvent._id.toString()

        // Update status to processing
        await updateEventStatus(eventId, "processing")

        // TODO: Implement business logic for full data synchronization
        // Example:
        // - Fetch all organizations from UMS API
        // - Fetch all users from UMS API
        // - Compare with local database
        // - Update/create/delete records as needed
        // - Generate sync report
        // - Handle conflicts and errors

        // Update status to completed
        await updateEventStatus(eventId, "completed")

        const duration = Date.now() - startTime
        logger.info("ums.sync event processed successfully", {
            eventId,
            routingKey,
            duration,
        })
    } catch (error) {
        logger.error("Error processing ums.sync event", {
            eventId,
            routingKey,
            error: error.message,
            stack: error.stack,
        })

        // Update event status to failed if we have an eventId
        if (eventId) {
            try {
                await updateEventStatus(eventId, "failed", error.message)
            } catch (updateError) {
                logger.error("Failed to update event status to failed", {
                    eventId,
                    error: updateError.message,
                })
            }
        }

        throw error
    }
}

module.exports = {
    handleOrganizationCreated,
    handleOrganizationUserCreated,
    handleSyncAllData,
}
