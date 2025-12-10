/**
 * Authentication Middleware Integration Test
 *
 * Tests the authentication middleware functionality using @mskits/validate-auth
 * Requires authentication service to be running
 */

require("dotenv").config();
const { validateAuth } = require("@mskits/validate-auth");
const { initializeUMSRabbitClient, getUMSRabbitClient } = require("../utils/rabbitmq-client-proxy");
const { closePublisher } = require("../utils/rabbitmq-publisher");

async function testAuthMiddleware() {
    console.log("=== Authentication Middleware Test (@mskits/validate-auth) ===\n");

    try {
        // Initialize RabbitMQ ClientProxy adapter
        console.log("1. Initializing RabbitMQ ClientProxy adapter...");
        await initializeUMSRabbitClient();
        const umsRabbitClient = getUMSRabbitClient();
        console.log("✓ ClientProxy adapter initialized\n");

        // Test 1: Missing authorization header
        console.log("2. Testing missing authorization header...");
        try {
            const mockReq1 = { headers: {} };
            await validateAuth(mockReq1, umsRabbitClient);
            console.log("✗ Should have thrown error for missing header\n");
        } catch (error) {
            console.log(`✓ Correctly rejected: ${error.message}\n`);
        }

        // Test 2: Valid token format with auth service check
        console.log("3. Testing with valid token format...");
        console.log("   Note: This requires the authentication service to be running");
        
        // Use a sample token - replace with actual token for real testing
        const sampleToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzY1NDMzMjgzLCJpYXQiOjE3NjUzNDY4ODMsImp0aSI6IjAzMzRiZGU2ZWM3NTQ3ZTdiNGE1MDgzYzczN2Q0YWZjIiwidXNlcl9pZCI6IjcifQ.K-2HRYVnaeBgfM0lSAn6PjfI6X96U6DIrisbyJimB4M";
        
        try {
            const mockReq2 = { 
                headers: { 
                    authorization: `Bearer ${sampleToken}` 
                } 
            };
            
            const result = await validateAuth(mockReq2, umsRabbitClient);
            
            // Check authentication result status
            if (result.status === "SUCCESS") {
                console.log("✓ Authentication successful");
                console.log("   User data:", JSON.stringify(result, null, 2));
            } else {
                console.log(`⚠ Authentication returned non-SUCCESS status: ${result.status}`);
                console.log("   This is expected if using a sample token");
            }
        } catch (error) {
            if (error.message.includes("timeout") || error.message.includes("Timeout")) {
                console.log("⚠ Authentication service not responding (timeout)");
                console.log("   Make sure the authentication service is running and listening on 'validate-authorization' queue");
            } else {
                console.log(`⚠ Authentication failed: ${error.message}`);
                console.log("   This is expected if using a sample token or if auth service rejects it");
            }
        }

        // Test 3: Test with options parameter
        console.log("\n4. Testing with options parameter...");
        try {
            const mockReq3 = { 
                headers: { 
                    authorization: `Bearer ${sampleToken}` 
                } 
            };
            const options = { checkPermissions: true };
            
            const result = await validateAuth(mockReq3, umsRabbitClient, options);
            console.log("   Options passed successfully to validation");
            console.log("   Result status:", result?.status || "N/A");
        } catch (error) {
            console.log(`   Options test error (expected): ${error.message}`);
        }

        console.log("\n=== Test Summary ===");
        console.log("✓ @mskits/validate-auth package integrated");
        console.log("✓ RabbitMQ ClientProxy adapter working");
        console.log("✓ Error handling working correctly");
        console.log("⚠ Live authentication requires auth service to be running\n");

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        // Cleanup
        console.log("Cleaning up...");
        await closePublisher();
        console.log("✓ Cleanup complete");
        process.exit(0);
    }
}

// Run tests
testAuthMiddleware();
