/**
 * Query Routes
 *
 * Defines API endpoints for retrieving users and organizations
 */

const express = require("express")
const router = express.Router()
const queryController = require("../controllers/query-controller")

/**
 * @route   GET /api/query/user/:user_id
 * @desc    Get user by user_id with populated batch and organization
 * @access  Public
 */
router.get("/user/:user_id", queryController.getUserById.bind(queryController))

/**
 * @route   GET /api/query/organization/:org_id
 * @desc    Get organization by org_id with all associated users
 * @access  Public
 */
router.get(
    "/organization/:org_id",
    queryController.getOrganizationById.bind(queryController)
)

module.exports = router
