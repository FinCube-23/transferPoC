/**
 * RabbitMQ Event Handlers
 *
 * Handler functions for processing events received from the User Management System (UMS).
 * Each handler processes a specific event type and includes placeholders for business logic.
 */

const { Logger } = require("./logger")
const { storeEvent, updateEventStatus } = require("./event-store")
const Organization = require("../models/organization.js")
const UserManagementService = require("../services/user-management-service.js")
const User = require("../models/user")

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

        const orgId = payload?.data?.organization_id
        if (!orgId) throw new Error("Organization id required")

        const org = await Organization.findOne({
            org_id: orgId,
        })
        if (!org) throw new Error("Organization not found")

        const reference_number = UserManagementService.generateReferenceNumber(
            org.wallet_address
        )

        const userData = {
            email: payload?.data.user_email,
            user_id: payload?.data.user_id,
            balance: 10, // For now
            orgWalletAddress: org.wallet_address,
            reference_number: reference_number,
        }
        const user = await UserManagementService.createUserWithBatch(userData)

        logger.info("New User Created", user)

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

        const syncData = payload?.data
        if (!syncData) {
            throw new Error("Invalid sync payload: missing data field")
        }

        const { organizations = [], users = [] } = syncData

        const syncReport = {
            organizations: {
                total: organizations.length,
                created: 0,
                skipped: 0,
                failed: 0,
            },
            users: {
                total: users.length,
                created: 0,
                skipped: 0,
                failed: 0,
            },
            errors: [],
        }

        // Step 1: Sync organizations
        logger.info("Starting organization sync", {
            totalOrganizations: organizations.length,
        })

        for (const org of organizations) {
            try {
                if (org.name === "Brain Station 23") {
                    logger.warn(
                        "Skipping Super Organization",
                        {
                            orgId: org.id,
                            orgName: org.name,
                        }
                    )
                    syncReport.organizations.skipped++
                    continue
                }
                const orgAdmin = org.organization_admin
                if (!orgAdmin || !orgAdmin.wallet_address) {
                    logger.warn(
                        "Skipping organization without wallet address",
                        {
                            orgId: org.id,
                            orgName: org.name,
                        }
                    )
                    syncReport.organizations.skipped++
                    continue
                }

                // Check if organization already exists
                const existingOrg = await Organization.findOne({
                    org_id: org.id,
                })

                if (existingOrg) {
                    logger.info("Organization already exists, skipping", {
                        orgId: org.id,
                        orgName: org.name,
                    })
                    syncReport.organizations.skipped++
                    continue
                }

                // Create new organization
                const newOrganization = new Organization({
                    org_id: org.id,
                    wallet_address: orgAdmin.wallet_address,
                })
                await newOrganization.save()

                logger.info("Organization created during sync", {
                    orgId: org.id,
                    orgName: org.name,
                    walletAddress: orgAdmin.wallet_address,
                })
                syncReport.organizations.created++
            } catch (error) {
                logger.error("Failed to sync organization", {
                    orgId: org.id,
                    orgName: org.name,
                    error: error.message,
                })
                syncReport.organizations.failed++
                syncReport.errors.push({
                    type: "organization",
                    id: org.id,
                    error: error.message,
                })
            }
        }

        // Step 2: Sync users
        logger.info("Starting user sync", {
            totalUsers: users.length,
        })

        for (const user of users) {
            try {
                // Skip users without email
                if (!user.email) {
                    logger.warn("Skipping user without email", {
                        userId: user.id,
                        email: user.email,
                    })
                    syncReport.users.skipped++
                    continue
                }

                // Check if user already exists
                const existingUser = await User.findOne({
                    user_id: user.id,
                })

                if (existingUser) {
                    logger.info("User already exists, skipping", {
                        userId: user.id,
                        email: user.email,
                    })
                    syncReport.users.skipped++
                    continue
                }

                // Find user's organization by checking which org has this user as member
                let userOrg = null
                for (const org of organizations) {
                    if (org.members && org.members.includes(user.id)) {
                        userOrg = org
                    }
                }

                if (!userOrg || !userOrg.organization_admin?.wallet_address) {
                    logger.warn("Skipping user without valid organization", {
                        userId: user.id,
                        email: user.email,
                    })
                    syncReport.users.skipped++
                    continue
                }

                // Get organization from database
                const org = await Organization.findOne({
                    org_id: userOrg.id,
                })

                if (!org) {
                    logger.warn("Organization not found for user", {
                        userId: user.id,
                        orgId: userOrg.id,
                    })
                    syncReport.users.skipped++
                    continue
                }

                // Generate reference number
                const reference_number =
                    UserManagementService.generateReferenceNumber(
                        org.wallet_address
                    )

                // Create user with batch assignment
                const userData = {
                    email: user.email,
                    user_id: user.id,
                    balance: 10, // Default balance
                    orgWalletAddress: org.wallet_address,
                    reference_number: reference_number,
                }

                const result = await UserManagementService.createUserWithBatch(
                    userData
                )

                if (result.success) {
                    logger.info("User created during sync", {
                        userId: user.id,
                        email: user.email,
                        orgId: userOrg.id,
                    })
                    syncReport.users.created++
                } else {
                    logger.error("Failed to create user during sync", {
                        userId: user.id,
                        email: user.email,
                        error: result.error,
                    })
                    syncReport.users.failed++
                    syncReport.errors.push({
                        type: "user",
                        id: user.id,
                        error: result.error.message,
                    })
                }
            } catch (error) {
                logger.error("Failed to sync user", {
                    userId: user.id,
                    email: user.email,
                    error: error.message,
                })
                syncReport.users.failed++
                syncReport.errors.push({
                    type: "user",
                    id: user.id,
                    error: error.message,
                })
            }
        }

        // Update status to completed
        await updateEventStatus(eventId, "completed")

        const duration = Date.now() - startTime
        logger.info("ums.sync event processed successfully", {
            eventId,
            routingKey,
            duration,
            syncReport,
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
