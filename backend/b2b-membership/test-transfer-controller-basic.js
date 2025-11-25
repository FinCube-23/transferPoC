/**
 * Basic test for Transfer Controller
 * Tests basic instantiation and method existence
 */

const TransferController = require("./controllers/transfer-controller")

console.log("Testing Transfer Controller...")

try {
    // Test 1: Instantiate controller
    const controller = new TransferController()
    console.log("✓ Controller instantiated successfully")

    // Test 2: Check executeTransfer method exists
    if (typeof controller.executeTransfer === "function") {
        console.log("✓ executeTransfer method exists")
    } else {
        throw new Error("executeTransfer method not found")
    }

    // Test 3: Check private methods exist
    const privateMethods = [
        "_validateTransferInputs",
        "_retrieveUserData",
        "_generateProof",
        "_generateNullifier",
        "_createMemo",
        "_validateMemoLength",
    ]

    for (const method of privateMethods) {
        if (typeof controller[method] === "function") {
            console.log(`✓ ${method} method exists`)
        } else {
            throw new Error(`${method} method not found`)
        }
    }

    // Test 4: Test input validation
    console.log("\nTesting input validation...")

    const validationTests = [
        {
            name: "Valid inputs",
            inputs: ["0x123_uuid", 100, 1],
            expectedValid: true,
        },
        {
            name: "Invalid receiver_reference_number (empty)",
            inputs: ["", 100, 1],
            expectedValid: false,
        },
        {
            name: "Invalid amount (negative)",
            inputs: ["0x123_uuid", -100, 1],
            expectedValid: false,
        },
        {
            name: "Invalid amount (zero)",
            inputs: ["0x123_uuid", 0, 1],
            expectedValid: false,
        },
        {
            name: "Invalid sender_user_id (negative)",
            inputs: ["0x123_uuid", 100, -1],
            expectedValid: false,
        },
        {
            name: "Invalid sender_user_id (zero)",
            inputs: ["0x123_uuid", 100, 0],
            expectedValid: false,
        },
        {
            name: "Invalid sender_user_id (non-integer)",
            inputs: ["0x123_uuid", 100, 1.5],
            expectedValid: false,
        },
    ]

    for (const test of validationTests) {
        const result = controller._validateTransferInputs(...test.inputs)
        if (result.valid === test.expectedValid) {
            console.log(`✓ ${test.name}: ${result.valid ? "valid" : "invalid"}`)
        } else {
            throw new Error(
                `${test.name} failed: expected ${test.expectedValid}, got ${result.valid}`
            )
        }
    }

    // Test 5: Test nullifier generation
    console.log("\nTesting nullifier generation...")
    const nullifier1 = controller._generateNullifier()
    const nullifier2 = controller._generateNullifier()

    // Check format
    if (nullifier1.match(/^0x[0-9a-fA-F]{64}$/)) {
        console.log("✓ Nullifier format is correct")
    } else {
        throw new Error(`Invalid nullifier format: ${nullifier1}`)
    }

    // Check uniqueness
    if (nullifier1 !== nullifier2) {
        console.log("✓ Nullifiers are unique")
    } else {
        throw new Error("Nullifiers are not unique")
    }

    // Test 6: Test memo creation
    console.log("\nTesting memo creation...")
    const memo = controller._createMemo(
        "sender_ref",
        "receiver_ref",
        "0xSender",
        "0xReceiver",
        100
    )

    // Check it's valid JSON
    const memoObj = JSON.parse(memo)
    console.log("✓ Memo is valid JSON")

    // Check required fields
    const requiredFields = [
        "sender_reference_number",
        "receiver_reference_number",
        "sender_wallet_address",
        "receiver_wallet_address",
        "amount",
        "timestamp",
    ]

    for (const field of requiredFields) {
        if (field in memoObj) {
            console.log(`✓ Memo contains ${field}`)
        } else {
            throw new Error(`Memo missing required field: ${field}`)
        }
    }

    // Test 7: Test memo with missing reference numbers
    console.log("\nTesting memo with missing reference numbers...")
    const memoWithMissing = controller._createMemo(
        null,
        undefined,
        "0xSender",
        "0xReceiver",
        100
    )
    const memoWithMissingObj = JSON.parse(memoWithMissing)

    if (memoWithMissingObj.sender_reference_number === "") {
        console.log("✓ Missing sender reference number handled as empty string")
    } else {
        throw new Error(
            `Expected empty string, got: ${memoWithMissingObj.sender_reference_number}`
        )
    }

    if (memoWithMissingObj.receiver_reference_number === "") {
        console.log(
            "✓ Missing receiver reference number handled as empty string"
        )
    } else {
        throw new Error(
            `Expected empty string, got: ${memoWithMissingObj.receiver_reference_number}`
        )
    }

    // Test 8: Test memo length validation
    console.log("\nTesting memo length validation...")

    // Valid memo
    const shortMemo = "a".repeat(100)
    const shortValidation = controller._validateMemoLength(shortMemo)
    if (shortValidation.valid) {
        console.log("✓ Short memo passes validation")
    } else {
        throw new Error("Short memo should be valid")
    }

    // Invalid memo (too long)
    const longMemo = "a".repeat(2000)
    const longValidation = controller._validateMemoLength(longMemo)
    if (
        !longValidation.valid &&
        longValidation.error.type === "MEMO_TOO_LONG"
    ) {
        console.log("✓ Long memo fails validation with MEMO_TOO_LONG error")
    } else {
        throw new Error("Long memo should be invalid")
    }

    console.log("\n========================================")
    console.log("All basic tests passed! ✓")
    console.log("========================================")
} catch (error) {
    console.error("\n✗ Test failed:", error.message)
    console.error(error.stack)
    process.exit(1)
}
