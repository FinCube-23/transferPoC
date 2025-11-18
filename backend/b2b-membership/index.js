require("dotenv").config()
const express = require("express")
const cors = require("cors")

const app = express()

// Middleware configuration
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "zkp-proof-controller" })
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

// Start server
const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
    console.log(`ZKP Proof Controller server is running on port ${PORT}`)
    console.log(
        `Environment: ${process.env.ALCHEMY_NETWORK || "not configured"}`
    )
})
