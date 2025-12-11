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
 * Handle single organization user creation
 *
 * Processes creation of a single user in an organization.
 * This is called by the routing handler for non-bulk approved user sync events.
 * Note: Event storage and status updates are handled by the calling router function.
 *
 * @param {string} routingKey - The RabbitMQ routing key
 * @param {object} payload - The parsed JSON payload containing user and organization data
 * @returns {Promise<void>}
 * @throws {Error} If processing fails
 */
async function handleOrganizationUserCreated(routingKey, payload) {
    const startTime = Date.now()
    logger.info("Processing single user creation", {
        routingKey,
        userId: payload?.data?.user_id,
        organizationId: payload?.data?.organization_id,
    })

    try {
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

        const duration = Date.now() - startTime
        logger.info("Single organization user created successfully", {
            userId: payload?.data?.user_id,
            routingKey,
            duration,
        })
    } catch (error) {
        logger.error("Error creating single organization user", {
            userId: payload?.data?.user_id,
            routingKey,
            error: error.message,
            stack: error.stack,
        })

        throw error
    }
}

/**
 * Handle organization.user.sync event (Main Router)
 *
 * Routes the event to appropriate handler based on is_bulk and is_approved flags.
 * - Single approved: creates one user
 * - Single not approved: removes one user (future implementation)
 * - Bulk approved: creates multiple users
 * - Bulk not approved: removes multiple users (future implementation)
 *
 * @param {string} routingKey - The RabbitMQ routing key
 * @param {object} payload - The parsed JSON payload containing sync data
 * @returns {Promise<void>}
 * @throws {Error} If processing fails
 */
async function handleOrganizationUserSync(routingKey, payload) {
    const startTime = Date.now()
    logger.info("Processing organization.user.sync event (router)", {
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

        // Extract routing flags from payload
        const isBulk = payload?.data?.is_bulk
        const isApproved = payload?.data?.is_approved

        // Validate required flags
        if (isBulk === undefined || isApproved === undefined) {
            throw new Error(
                "Missing required flags: is_bulk and is_approved must be present"
            )
        }

        // Route to appropriate handler based on flags
        if (!isBulk && isApproved) {
            // Single user creation
            logger.info("Routing to single user creation handler", {
                eventId,
            })
            await handleOrganizationUserCreated(routingKey, payload)
        } else if (!isBulk && !isApproved) {
            // Single user removal
            logger.info("Routing to single user removal handler", {
                eventId,
            })
            await handleOrganizationUserRemove(routingKey, payload)
        } else if (isBulk && isApproved) {
            // Bulk user creation
            logger.info("Routing to bulk user creation handler", {
                eventId,
            })
            await handleOrganizationUserCreatedBulk(routingKey, payload)
        } else if (isBulk && !isApproved) {
            // Bulk user removal
            logger.info("Routing to bulk user removal handler", {
                eventId,
            })
            await handleOrganizationUserRemovedBulk(routingKey, payload)
        }

        // Update status to completed
        await updateEventStatus(eventId, "completed")

        const duration = Date.now() - startTime
        logger.info("organization.user.sync event routed successfully", {
            eventId,
            routingKey,
            isBulk,
            isApproved,
            duration,
        })
    } catch (error) {
        logger.error("Error processing organization.user.sync event", {
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
 * Handle bulk organization user creation
 *
 * Processes creation of multiple users in an organization.
 * Delegates to handleOrganizationUserCreated for each user.
 *
 * @param {string} routingKey - The RabbitMQ routing key
 * @param {object} payload - The parsed JSON payload containing bulk user data
 * @returns {Promise<void>}
 * @throws {Error} If processing fails
 */
async function handleOrganizationUserCreatedBulk(routingKey, payload) {
    const startTime = Date.now()
    logger.info("Processing bulk organization user creation", {
        routingKey,
        payload,
    })

    try {
        const userIds = payload?.data?.user_ids
        const userEmails = payload?.data?.user_emails
        const organizationId = payload?.data?.organization_id
        const organizationName = payload?.data?.organization_name
        const updatedCount = payload?.data?.updated_count

        // If no users to create, log and exit
        if (parseInt(updatedCount) <= 0) {
            logger.info("No new users to create in bulk operation", {
                routingKey,
                organizationId,
                organizationName,
                updatedCount,
            })
            return
        }

        // Validate required fields
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            throw new Error("Invalid or empty user_ids array")
        }

        if (
            !userEmails ||
            !Array.isArray(userEmails) ||
            userEmails.length === 0
        ) {
            throw new Error("Invalid or empty user_emails array")
        }

        if (userIds.length !== userEmails.length) {
            throw new Error(
                "user_ids and user_emails arrays must have the same length"
            )
        }

        if (!organizationId) {
            throw new Error("Organization ID is required")
        }

        logger.info("Starting bulk user creation", {
            organizationId,
            organizationName,
            userCount: userIds.length,
            updatedCount,
        })

        const results = {
            total: userIds.length,
            successful: 0,
            failed: 0,
            errors: [],
        }

        // Process each user
        for (let i = 0; i < userIds.length; i++) {
            const userId = userIds[i]
            const userEmail = userEmails[i]

            try {
                // Create single user payload
                const singleUserPayload = {
                    data: {
                        user_id: userId,
                        user_email: userEmail,
                        organization_id: organizationId,
                        organization_name: organizationName,
                    },
                }

                // Delegate to single user creation handler
                await handleOrganizationUserCreated(
                    routingKey,
                    singleUserPayload
                )

                results.successful++
                logger.info("Bulk user creation: user processed successfully", {
                    userId,
                    userEmail,
                })
            } catch (error) {
                results.failed++
                results.errors.push({
                    userId,
                    userEmail,
                    error: error.message,
                })
                logger.error("Bulk user creation: failed to process user", {
                    userId,
                    userEmail,
                    error: error.message,
                })
                // Continue processing other users instead of throwing
            }
        }

        const duration = Date.now() - startTime
        logger.info("Bulk organization user creation completed", {
            routingKey,
            organizationId,
            results,
            duration,
        })

        // Throw error if all users failed
        if (results.failed === results.total) {
            throw new Error(
                `All ${results.total} users failed to be created. See logs for details.`
            )
        }
    } catch (error) {
        logger.error("Error in bulk organization user creation", {
            routingKey,
            error: error.message,
            stack: error.stack,
        })
        throw error
    }
}

/**
 * Handle single organization user removal
 *
 * Processes removal of a single user from an organization.
 * Removes the user's secret from the batch polynomial and deletes the user record.
 *
 * @param {string} routingKey - The RabbitMQ routing key
 * @param {object} payload - The parsed JSON payload containing user removal data
 * @returns {Promise<void>}
 * @throws {Error} If processing fails
 */
async function handleOrganizationUserRemove(routingKey, payload) {
    const startTime = Date.now()
    logger.info("Processing single user removal", {
        routingKey,
        userId: payload?.data?.user_id,
        organizationId: payload?.data?.organization_id,
    })

    try {
        // Step 1: Validate payload for required fields (user_id, organization_id)
        const userId = payload?.data?.user_id
        const organizationId = payload?.data?.organization_id

        if (!userId) {
            throw new Error("User ID is required")
        }

        if (!organizationId) {
            throw new Error("Organization ID is required")
        }

        // Step 2: Check if the user exists by user_id
        const user = await User.findOne({ user_id: userId })

        // Step 3: If user not found, log and exit
        if (!user) {
            logger.info("User not found, skipping removal", {
                userId,
                organizationId,
                routingKey,
            })
            return
        }

        // Step 4: Get the organization to get wallet address
        const organization = await Organization.findOne({
            org_id: organizationId,
        })

        if (!organization) {
            throw new Error(
                `Organization not found with org_id: ${organizationId}`
            )
        }

        // Step 5-8: Use UserManagementService to handle the complete removal process
        const userData = {
            email: user.zkp_key, // This is the email stored as zkp_key
            user_id: userId,
            orgWalletAddress: organization.wallet_address,
        }

        const result = await UserManagementService.removeUserWithBatch(userData)

        if (!result.success) {
            throw new Error(`Failed to remove user: ${result.error.message}`)
        }

        // Step 9: Log success message
        const duration = Date.now() - startTime
        logger.info("Single organization user removed successfully", {
            userId,
            organizationId,
            routingKey,
            duration,
        })
    } catch (error) {
        // Step 10: Handle errors and log appropriately
        logger.error("Error removing single organization user", {
            userId: payload?.data?.user_id,
            organizationId: payload?.data?.organization_id,
            routingKey,
            error: error.message,
            stack: error.stack,
        })

        throw error
    }
}

/**
 * Handle bulk organization user removal
 *
 * Processes removal of multiple users from an organization.
 * Delegates to handleOrganizationUserRemove for each user.
 *
 * @param {string} routingKey - The RabbitMQ routing key
 * @param {object} payload - The parsed JSON payload containing bulk user removal data
 * @returns {Promise<void>}
 * @throws {Error} If processing fails
 */
async function handleOrganizationUserRemovedBulk(routingKey, payload) {
    const startTime = Date.now()
    logger.info("Processing bulk organization user removal", {
        routingKey,
        payload,
    })

    try {
        const userIds = payload?.data?.user_ids
        const organizationId = payload?.data?.organization_id
        const organizationName = payload?.data?.organization_name
        const updatedCount = payload?.data?.updated_count

        // If no users to remove, log and exit
        if (parseInt(updatedCount) <= 0) {
            logger.info("No users to remove in bulk operation", {
                routingKey,
                organizationId,
                organizationName,
                updatedCount,
            })
            return
        }

        // Validate required fields
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            throw new Error("Invalid or empty user_ids array")
        }

        if (!organizationId) {
            throw new Error("Organization ID is required")
        }

        logger.info("Starting bulk user removal", {
            organizationId,
            organizationName,
            userCount: userIds.length,
            updatedCount,
        })

        const results = {
            total: userIds.length,
            successful: 0,
            failed: 0,
            errors: [],
        }

        // Process each user
        for (let i = 0; i < userIds.length; i++) {
            const userId = userIds[i]

            try {
                // Create single user payload
                const singleUserPayload = {
                    data: {
                        user_id: userId,
                        organization_id: organizationId,
                        organization_name: organizationName,
                    },
                }

                // Delegate to single user removal handler
                await handleOrganizationUserRemove(
                    routingKey,
                    singleUserPayload
                )

                results.successful++
                logger.info("Bulk user removal: user processed successfully", {
                    userId,
                })
            } catch (error) {
                results.failed++
                results.errors.push({
                    userId,
                    error: error.message,
                })
                logger.error("Bulk user removal: failed to process user", {
                    userId,
                    error: error.message,
                })
                // Continue processing other users instead of throwing
            }
        }

        const duration = Date.now() - startTime
        logger.info("Bulk organization user removal completed", {
            routingKey,
            organizationId,
            results,
            duration,
        })

        // Throw error if all users failed
        if (results.failed === results.total) {
            throw new Error(
                `All ${results.total} users failed to be removed. See logs for details.`
            )
        }
    } catch (error) {
        logger.error("Error in bulk organization user removal", {
            routingKey,
            error: error.message,
            stack: error.stack,
        })
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
                    logger.warn("Skipping Super Organization", {
                        orgId: org.id,
                        orgName: org.name,
                    })
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
    handleOrganizationUserSync,
    handleOrganizationUserCreated,
    handleOrganizationUserCreatedBulk,
    handleOrganizationUserRemove,
    handleOrganizationUserRemovedBulk,
    handleSyncAllData,
}
