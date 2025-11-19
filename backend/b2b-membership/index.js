require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { connectDatabase, disconnectDatabase } = require("./utils/database")

const app = express()

// Middleware configuration
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get("/health", (req, res) => {
    const mongoose = require("mongoose")
    const dbStatus =
        mongoose.connection.readyState === 1 ? "connected" : "disconnected"

    res.json({
        status: "ok",
        service: "zkp-proof-controller",
        database: dbStatus,
    })
})

// API routes
const proofRoutes = require("./routes/proof-routes")
app.use("/api/proof", proofRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Error:", err)
    res.status(500).json({
        success: false,
        error: {
            type: "INTERNAL_ERROR",
            message: err.message || "An unexpected error occurred",
        },
    })
})

// Start server with database connection
const PORT = process.env.PORT || 8000

async function startServer() {
    try {
        // Connect to database before starting server
        await connectDatabase()

        app.listen(PORT, () => {
            console.log(
                `ZKP Proof Controller server is running on port ${PORT}`
            )
            console.log(
                `Environment: ${
                    process.env.ALCHEMY_NETWORK || "not configured"
                }`
            )
        })
    } catch (error) {
        console.error("Failed to start server:", error)
        process.exit(1)
    }
}

// Graceful shutdown handler
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log(`\n${signal} received. Shutting down gracefully...`)

        try {
            await disconnectDatabase()
            console.log("Server shutdown complete")
            process.exit(0)
        } catch (error) {
            console.error("Error during shutdown:", error)
            process.exit(1)
        }
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))
}

// Initialize server
setupGracefulShutdown()
startServer()
