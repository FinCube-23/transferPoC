import { expect } from "chai"
import { ethers } from "hardhat"
import * as fs from "fs"
import * as path from "path"

describe("HonkVerifier", function () {
    let honkVerifier: any
    let zkTranscriptLib: any

    before(async function () {
        // Deploy ZKTranscriptLib library first
        const ZKTranscriptLib = await ethers.getContractFactory(
            "ZKTranscriptLib"
        )
        zkTranscriptLib = await ZKTranscriptLib.deploy()
        await zkTranscriptLib.waitForDeployment()

        const zkTranscriptLibAddress = await zkTranscriptLib.getAddress()
        console.log("ZKTranscriptLib deployed to:", zkTranscriptLibAddress)

        // Deploy HonkVerifier with library linking
        const HonkVerifier = await ethers.getContractFactory("HonkVerifier", {
            libraries: {
                ZKTranscriptLib: zkTranscriptLibAddress,
            },
        })
        honkVerifier = await HonkVerifier.deploy()
        await honkVerifier.waitForDeployment()

        console.log(
            "HonkVerifier deployed to:",
            await honkVerifier.getAddress()
        )
    })

    describe("Deployment", function () {
        it("Should deploy HonkVerifier successfully", async function () {
            expect(await honkVerifier.getAddress()).to.be.properAddress
        })
    })

    describe("Proof Verification", function () {
        it("Should verify a valid proof", async function () {
            // Read the valid proof from dummy_data
            const proofPath = path.join(__dirname, "dummy_data", "proof")
            const proofBuffer = fs.readFileSync(proofPath)
            const proofBytes = "0x" + proofBuffer.toString("hex")

            // Read the valid public inputs from dummy_data
            const publicInputsPath = path.join(
                __dirname,
                "dummy_data",
                "public_inputs"
            )
            const publicInputsBuffer = fs.readFileSync(publicInputsPath)

            // Parse public inputs - each input is 32 bytes (bytes32)
            // The file contains 19 public inputs (as per NUMBER_OF_PUBLIC_INPUTS constant)
            const publicInputs: string[] = []
            const numInputs = 19

            for (let i = 0; i < numInputs; i++) {
                const start = i * 32
                const end = start + 32
                const inputBytes = publicInputsBuffer.subarray(start, end)
                const inputHex = "0x" + inputBytes.toString("hex")
                publicInputs.push(inputHex)
            }

            console.log("Proof length:", proofBytes.length)
            console.log("Number of public inputs:", publicInputs.length)

            // Call the verify function
            const result = await honkVerifier.verify(proofBytes, publicInputs)

            // The proof should be valid
            expect(result).to.be.true
        })

        it("Should reject an invalid proof", async function () {
            // Create an invalid proof by modifying the valid one
            const proofPath = path.join(__dirname, "dummy_data", "proof")
            const proofBuffer = fs.readFileSync(proofPath)

            // Corrupt the proof by changing some bytes
            const corruptedProof = Buffer.from(proofBuffer)
            corruptedProof[100] = corruptedProof[100] ^ 0xff // Flip bits
            corruptedProof[200] = corruptedProof[200] ^ 0xff // Flip bits
            const invalidProofBytes = "0x" + corruptedProof.toString("hex")

            // Use valid public inputs
            const publicInputsPath = path.join(
                __dirname,
                "dummy_data",
                "public_inputs"
            )
            const publicInputsBuffer = fs.readFileSync(publicInputsPath)

            const publicInputs: string[] = []
            const numInputs = 19

            for (let i = 0; i < numInputs; i++) {
                const start = i * 32
                const end = start + 32
                const inputBytes = publicInputsBuffer.subarray(start, end)
                const inputHex = "0x" + inputBytes.toString("hex")
                publicInputs.push(inputHex)
            }

            // The verification should fail (return false or revert)
            try {
                const result = await honkVerifier.verify(
                    invalidProofBytes,
                    publicInputs
                )
                // If it doesn't revert, it should return false
                expect(result).to.be.false
            } catch (error: any) {
                // If it reverts, that's also acceptable behavior
                expect(error.message).to.match(
                    /SumcheckFailed|ShpleminiFailed|ConsistencyCheckFailed/
                )
            }
        })

        it("Should reject proof with wrong number of public inputs", async function () {
            const proofPath = path.join(__dirname, "dummy_data", "proof")
            const proofBuffer = fs.readFileSync(proofPath)
            const proofBytes = "0x" + proofBuffer.toString("hex")

            // Create wrong number of public inputs (should be 19)
            const wrongPublicInputs = [
                "0x0000000000000000000000000000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000000000000000000000000000002",
            ]

            // Should revert with PublicInputsLengthWrong
            await expect(
                honkVerifier.verify(proofBytes, wrongPublicInputs)
            ).to.be.revertedWithCustomError(
                honkVerifier,
                "PublicInputsLengthWrong"
            )
        })

        it("Should reject proof with wrong length", async function () {
            // Create a proof with wrong length
            const wrongProof = "0x1234567890abcdef"

            const publicInputsPath = path.join(
                __dirname,
                "dummy_data",
                "public_inputs"
            )
            const publicInputsBuffer = fs.readFileSync(publicInputsPath)

            const publicInputs: string[] = []
            const numInputs = 19

            for (let i = 0; i < numInputs; i++) {
                const start = i * 32
                const end = start + 32
                const inputBytes = publicInputsBuffer.subarray(start, end)
                const inputHex = "0x" + inputBytes.toString("hex")
                publicInputs.push(inputHex)
            }

            // Should revert with ProofLengthWrong or ProofLengthWrongWithLogN
            await expect(honkVerifier.verify(wrongProof, publicInputs)).to.be
                .reverted
        })
    })
})
