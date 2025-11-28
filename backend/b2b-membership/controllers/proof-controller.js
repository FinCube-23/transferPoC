/**
 * ZKP Proof Controller
 *
 * Orchestrates zero-knowledge proof generation and on-chain verification
 * for B2B membership credentials.
 */

const { ethers } = require("ethers")
const { exec } = require("child_process")
const { promisify } = require("util")
const path = require("path")
const fs = require("fs").promises
require("dotenv").config()

const { Logger } = require("../utils/logger")
const userManagementService = require("../services/user-management-service")
const { generateUserSecret } = require("../utils/secret-generator")
const {
    stringsToBigInts,
    MAX_POLY_DEGREE,
} = require("../utils/polynomial-operations")
const { poseidon2Hash } = require("@zkpassport/poseidon2")

const execAsync = promisify(exec)

class ProofController {
    constructor() {
        // Base paths for circuit operations
        this.basePath = path.join(__dirname, "../../base")
        this.circuitPath = path.join(this.basePath, "circuit")
        this.targetPath = path.join(this.circuitPath, "target")

        // Blockchain configuration
        this.alchemyApiKey = process.env.ALCHEMY_API_KEY
        this.alchemyNetwork = process.env.ALCHEMY_NETWORK || "eth-sepolia"
        this.walletPrivateKey = process.env.WALLET_PRIVATE_KEY

        // Initialize provider and wallet (lazy initialization)
        this.provider = null
        this.wallet = null

        // Initialize logger
        this.logger = new Logger("ProofController")
    }

    /**
     * Initialize Alchemy provider and wallet
     * @returns {Promise<{success: boolean, provider?: object, wallet?: object, error?: object}>}
     */
    async initializeProvider() {
        this.logger.info("Initializing Alchemy Provider")

        try {
            // Validate environment variables
            if (!this.alchemyApiKey) {
                throw new Error("ALCHEMY_API_KEY not configured in environment")
            }

            if (!this.walletPrivateKey) {
                throw new Error(
                    "WALLET_PRIVATE_KEY not configured in environment"
                )
            }

            // Initialize Alchemy provider
            // Network format: celo-sepolia, eth-sepolia, etc. (with hyphen, not underscore)
            const networkName = this.alchemyNetwork.replace(/_/g, "-")
            const alchemyUrl = `https://${networkName}.g.alchemy.com/v2/${this.alchemyApiKey}`
            this.logger.info(`Connecting to Alchemy network: ${networkName}`)

            this.provider = new ethers.JsonRpcProvider(alchemyUrl)

            // Test connection
            try {
                const network = await this.provider.getNetwork()
                this.logger.info(
                    `Connected to network: ${network.name} (chainId: ${network.chainId})`
                )
            } catch (error) {
                throw new Error(
                    `Failed to connect to Alchemy: ${error.message}`
                )
            }

            // Create wallet instance with private key
            this.logger.info("Initializing wallet with private key")
            this.wallet = new ethers.Wallet(
                this.walletPrivateKey,
                this.provider
            )

            const walletAddress = await this.wallet.getAddress()
            this.logger.info(`Wallet initialized: ${walletAddress}`)

            // Check wallet balance
            try {
                const balance = await this.provider.getBalance(walletAddress)
                const balanceInEth = ethers.formatEther(balance)
                this.logger.info(`Wallet balance: ${balanceInEth} ETH`)
            } catch (error) {
                this.logger.warn(
                    `Could not fetch wallet balance: ${error.message}`
                )
            }

            this.logger.info("Provider and wallet initialization completed")

            return {
                success: true,
                provider: this.provider,
                wallet: this.wallet,
            }
        } catch (error) {
            this.logger.error("Failed to initialize provider", {
                error: error.message,
            })

            return {
                success: false,
                error: {
                    type: "PROVIDER_INITIALIZATION_FAILED",
                    message: "Failed to initialize Alchemy provider",
                    details: {
                        error: error.message,
                    },
                },
            }
        }
    }

    /**
     * Execute shell command with error handling
     * @param {string} command - Command to execute
     * @param {string} cwd - Working directory for command execution
     * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
     */
    async executeCommand(command, cwd = process.cwd()) {
        this.logger.commandStart(command, cwd)

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
            })

            this.logger.commandComplete(
                command,
                0,
                stdout.trim(),
                stderr.trim()
            )

            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0,
            }
        } catch (error) {
            const exitCode = error.code || 1
            const stdout = error.stdout ? error.stdout.trim() : ""
            const stderr = error.stderr ? error.stderr.trim() : error.message

            this.logger.commandComplete(command, exitCode, stdout, stderr)

            return {
                stdout,
                stderr,
                exitCode,
            }
        }
    }

    /**
     * Generate test data using test_data_generator.js or provided testConfig
     * @param {object} testConfig - Optional test configuration
     * @returns {Promise<{success: boolean, error?: object}>}
     */
    async generateTestData(testConfig = {}) {
        const stepName = "test_data_generation"
        const startTime = Date.now()

        this.logger.stepStart(stepName, "Generating test data")

        try {
            const proverTomlPath = path.join(this.circuitPath, "Prover.toml")

            // Check if testConfig is provided and has all required fields
            const hasCompleteConfig =
                testConfig &&
                testConfig.polynomial &&
                testConfig.polynomialHash !== undefined &&
                testConfig.secret !== undefined &&
                testConfig.verifierKey !== undefined &&
                testConfig.nullifier !== undefined &&
                testConfig.isKYCed !== undefined

            if (hasCompleteConfig) {
                // Use provided testConfig directly (already computed)
                this.logger.info(
                    "Using complete testConfig to generate Prover.toml"
                )

                // Create Prover.toml content
                const proverToml = `isKYCed = ${testConfig.isKYCed}
nullifier = "${testConfig.nullifier}"
polynomial = [${testConfig.polynomial.map((p) => `"${p}"`).join(", ")}]
polynomial_hash = "${testConfig.polynomialHash}"
secret = "${testConfig.secret}"
verifier_key = "${testConfig.verifierKey}"`

                // Write to Prover.toml
                await fs.writeFile(proverTomlPath, proverToml)
                this.logger.info("Prover.toml created with complete testConfig")
            } else if (testConfig && Object.keys(testConfig).length > 0) {
                // Partial config provided, compute missing fields
                this.logger.info(
                    "Using partial testConfig to generate Prover.toml"
                )

                const generatorPath = path.join(
                    this.basePath,
                    "utils/test_data_generator.js"
                )

                try {
                    const generator = require(generatorPath)

                    // Create a custom test config with provided values
                    const customConfig = {
                        roots: testConfig.roots || [123n, 456n, 789n],
                        userEmail: testConfig.userEmail || "test@example.com",
                        salt: testConfig.salt || "test_salt_123",
                        verifierKey:
                            testConfig.verifierKey || "verifier_key_456",
                        isKYCed:
                            testConfig.isKYCed !== undefined
                                ? testConfig.isKYCed
                                : true,
                    }

                    this.logger.debug("Custom test config", customConfig)

                    const crypto = require("crypto")
                    const FIELD_PRIME =
                        21888242871839275222246405745257275088548364400416034343698204186575808495617n

                    function hashToField(input) {
                        const hash = crypto
                            .createHash("sha256")
                            .update(input)
                            .digest("hex")
                        return BigInt("0x" + hash) % FIELD_PRIME
                    }

                    function toPositiveField(value) {
                        const r = value % FIELD_PRIME
                        return r >= 0n ? r : r + FIELD_PRIME
                    }

                    function interpolatePolynomial(roots) {
                        let polynomial = [1n]
                        for (const root of roots) {
                            const newPoly = new Array(
                                polynomial.length + 1
                            ).fill(0n)
                            for (let i = 0; i < polynomial.length; i++) {
                                newPoly[i] =
                                    (newPoly[i] - polynomial[i] * root) %
                                    FIELD_PRIME
                                newPoly[i + 1] =
                                    (newPoly[i + 1] + polynomial[i]) %
                                    FIELD_PRIME
                            }
                            polynomial = newPoly
                        }
                        return polynomial.map((coeff) => toPositiveField(coeff))
                    }

                    // Generate test data with custom config
                    const secret = hashToField(
                        customConfig.userEmail + customConfig.salt
                    )
                    const testRoots = [
                        ...customConfig.roots.map((r) => BigInt(r)),
                        secret,
                    ]
                    const polynomial = interpolatePolynomial(testRoots)

                    // Pad polynomial to MAX_POLY_DEGREE (must match main.nr)
                    const MAX_POLY_DEGREE = 128
                    const paddedPolynomial = [...polynomial]
                    while (paddedPolynomial.length <= MAX_POLY_DEGREE)
                        paddedPolynomial.push(0n)
                    const validatedPolynomial = paddedPolynomial.map((coeff) =>
                        toPositiveField(coeff)
                    )

                    // Generate polynomial hash and nullifier using Poseidon2
                    const polynomialHash =
                        generator.realPoseidon2Hash(validatedPolynomial)
                    const verifierKey = hashToField(customConfig.verifierKey)
                    const nullifier = generator.realPoseidon2Hash([
                        secret,
                        verifierKey,
                    ])

                    // Create Prover.toml content
                    const proverToml = `isKYCed = ${customConfig.isKYCed}
nullifier = "${nullifier}"
polynomial = [${validatedPolynomial.map((p) => `"${p}"`).join(", ")}]
polynomial_hash = "${polynomialHash}"
secret = "${secret}"
verifier_key = "${verifierKey}"`

                    // Write to Prover.toml
                    await fs.writeFile(proverTomlPath, proverToml)
                    this.logger.info(
                        "Prover.toml created with partial testConfig"
                    )
                } catch (generatorError) {
                    this.logger.error("Failed to use generator module", {
                        error: generatorError.message,
                    })
                    throw generatorError
                }
            } else {
                // No testConfig provided, use the default test_data_generator.js script
                this.logger.info(
                    "No testConfig provided, using default test_data_generator.js"
                )

                const generatorPath = path.join(
                    this.basePath,
                    "utils/test_data_generator.js"
                )

                // Execute test data generator with proper path quoting for spaces
                const quotedPath = `"${generatorPath}"`
                const result = await this.executeCommand(
                    `node ${quotedPath}`,
                    this.basePath
                )

                if (result.exitCode !== 0) {
                    this.logger.stepError(
                        stepName,
                        new Error("Test data generation failed"),
                        {
                            exitCode: result.exitCode,
                            stdout: result.stdout,
                            stderr: result.stderr,
                        }
                    )

                    return {
                        success: false,
                        error: {
                            type: "TEST_DATA_GENERATION_FAILED",
                            message: "Failed to generate test data",
                            step: "test_data_generation",
                            details: {
                                exitCode: result.exitCode,
                                stdout: result.stdout,
                                stderr: result.stderr,
                            },
                        },
                    }
                }
            }

            // Validate Prover.toml was created
            try {
                await fs.access(proverTomlPath)
                this.logger.debug("Prover.toml created successfully", {
                    path: proverTomlPath,
                })
            } catch (error) {
                this.logger.stepError(
                    stepName,
                    new Error("Prover.toml not found after generation"),
                    {
                        expectedPath: proverTomlPath,
                        error: error.message,
                    }
                )

                return {
                    success: false,
                    error: {
                        type: "TEST_DATA_GENERATION_FAILED",
                        message: "Prover.toml file not created",
                        step: "test_data_generation",
                        details: {
                            expectedPath: proverTomlPath,
                            error: error.message,
                        },
                    },
                }
            }

            const duration = Date.now() - startTime
            this.logger.stepComplete(stepName, duration, { proverTomlPath })

            return { success: true }
        } catch (error) {
            this.logger.stepError(stepName, error)

            return {
                success: false,
                error: {
                    type: "TEST_DATA_GENERATION_FAILED",
                    message: error.message,
                    step: "test_data_generation",
                },
            }
        }
    }

    /**
     * Compile circuit using nargo
     * @returns {Promise<{success: boolean, error?: object}>}
     */
    async compileCircuit() {
        const stepName = "compilation"
        const startTime = Date.now()

        this.logger.stepStart(stepName, "Compiling circuit using nargo")

        try {
            // Execute nargo compile in circuit directory
            const result = await this.executeCommand(
                "nargo compile",
                this.circuitPath
            )

            if (result.exitCode !== 0) {
                this.logger.stepError(
                    stepName,
                    new Error("Circuit compilation failed"),
                    {
                        exitCode: result.exitCode,
                        stdout: result.stdout,
                        stderr: result.stderr,
                    }
                )

                return {
                    success: false,
                    error: {
                        type: "COMPILATION_FAILED",
                        message: "Circuit compilation failed",
                        step: "compilation",
                        details: {
                            exitCode: result.exitCode,
                            stdout: result.stdout,
                            stderr: result.stderr,
                        },
                    },
                }
            }

            // Verify bytecode file was created
            const bytecodeFiles = await fs.readdir(this.targetPath)
            const jsonFiles = bytecodeFiles.filter((f) => f.endsWith(".json"))

            if (jsonFiles.length === 0) {
                this.logger.stepError(
                    stepName,
                    new Error("No bytecode file found"),
                    {
                        targetPath: this.targetPath,
                        filesFound: bytecodeFiles,
                    }
                )

                return {
                    success: false,
                    error: {
                        type: "COMPILATION_FAILED",
                        message: "Bytecode file not created",
                        step: "compilation",
                        details: {
                            targetPath: this.targetPath,
                            filesFound: bytecodeFiles,
                        },
                    },
                }
            }

            const duration = Date.now() - startTime
            this.logger.stepComplete(stepName, duration, {
                bytecodeFile: jsonFiles[0],
            })

            return { success: true, bytecodeFile: jsonFiles[0] }
        } catch (error) {
            this.logger.stepError(stepName, error)

            return {
                success: false,
                error: {
                    type: "COMPILATION_FAILED",
                    message: error.message,
                    step: "compilation",
                },
            }
        }
    }

    /**
     * Generate witness using nargo execute
     * @returns {Promise<{success: boolean, error?: object}>}
     */
    async generateWitness() {
        const stepName = "witness_generation"
        const startTime = Date.now()

        this.logger.stepStart(
            stepName,
            "Generating witness using nargo execute"
        )

        try {
            // Execute nargo execute in circuit directory
            const result = await this.executeCommand(
                "nargo execute",
                this.circuitPath
            )

            if (result.exitCode !== 0) {
                // Log Prover.toml contents for debugging
                const errorContext = {
                    exitCode: result.exitCode,
                    stdout: result.stdout,
                    stderr: result.stderr,
                }

                try {
                    const proverTomlPath = path.join(
                        this.circuitPath,
                        "Prover.toml"
                    )
                    const proverTomlContents = await fs.readFile(
                        proverTomlPath,
                        "utf-8"
                    )
                    errorContext.proverTomlContents = proverTomlContents
                    this.logger.fileContents(proverTomlPath, proverTomlContents)
                } catch (readError) {
                    this.logger.error(
                        "Could not read Prover.toml for debugging",
                        {
                            error: readError.message,
                        }
                    )
                }

                this.logger.stepError(
                    stepName,
                    new Error("Witness generation failed"),
                    errorContext
                )

                return {
                    success: false,
                    error: {
                        type: "WITNESS_GENERATION_FAILED",
                        message: "Witness generation failed",
                        step: "witness_generation",
                        details: {
                            exitCode: result.exitCode,
                            stdout: result.stdout,
                            stderr: result.stderr,
                        },
                    },
                }
            }

            // Verify witness file was created
            const witnessFiles = await fs.readdir(this.targetPath)
            const gzFiles = witnessFiles.filter((f) => f.endsWith(".gz"))

            if (gzFiles.length === 0) {
                this.logger.stepError(
                    stepName,
                    new Error("No witness file found"),
                    {
                        targetPath: this.targetPath,
                        filesFound: witnessFiles,
                    }
                )

                return {
                    success: false,
                    error: {
                        type: "WITNESS_GENERATION_FAILED",
                        message: "Witness file not created",
                        step: "witness_generation",
                        details: {
                            targetPath: this.targetPath,
                            filesFound: witnessFiles,
                        },
                    },
                }
            }

            const duration = Date.now() - startTime
            this.logger.stepComplete(stepName, duration, {
                witnessFile: gzFiles[0],
            })

            return { success: true, witnessFile: gzFiles[0] }
        } catch (error) {
            this.logger.stepError(stepName, error)

            return {
                success: false,
                error: {
                    type: "WITNESS_GENERATION_FAILED",
                    message: error.message,
                    step: "witness_generation",
                },
            }
        }
    }

    /**
     * Generate proof using Barretenberg
     * @param {string} bytecodeFile - Name of the bytecode file
     * @param {string} witnessFile - Name of the witness file
     * @returns {Promise<{success: boolean, error?: object}>}
     */
    async generateProofArtifacts(bytecodeFile, witnessFile) {
        const stepName = "proof_generation"
        const startTime = Date.now()

        this.logger.stepStart(stepName, "Generating proof using Barretenberg")

        try {
            const bytecodeBaseName = bytecodeFile.replace(".json", "")

            // Generate verification key FIRST (required by bb prove)
            this.logger.info("Generating verification key")

            const vkResult = await this.executeCommand(
                `bb write_vk -b ./target/${bytecodeFile} -o ./target --oracle_hash keccak`,
                this.circuitPath
            )

            if (vkResult.exitCode !== 0) {
                this.logger.stepError(
                    stepName,
                    new Error("Verification key generation failed"),
                    {
                        exitCode: vkResult.exitCode,
                        stdout: vkResult.stdout,
                        stderr: vkResult.stderr,
                    }
                )

                return {
                    success: false,
                    error: {
                        type: "PROOF_GENERATION_FAILED",
                        message: "Verification key generation failed",
                        step: "proof_generation",
                        details: {
                            exitCode: vkResult.exitCode,
                            stdout: vkResult.stdout,
                            stderr: vkResult.stderr,
                        },
                    },
                }
            }

            // Generate proof using Barretenberg (now that vk exists)
            this.logger.info("Generating proof with Barretenberg", {
                bytecodeFile,
                witnessFile,
            })

            const proveResult = await this.executeCommand(
                `bb prove -b ./target/${bytecodeFile} -w ./target/${witnessFile} -o ./target --oracle_hash keccak`,
                this.circuitPath
            )

            if (proveResult.exitCode !== 0) {
                this.logger.stepError(
                    stepName,
                    new Error("Barretenberg proof generation failed"),
                    {
                        exitCode: proveResult.exitCode,
                        stdout: proveResult.stdout,
                        stderr: proveResult.stderr,
                    }
                )

                return {
                    success: false,
                    error: {
                        type: "PROOF_GENERATION_FAILED",
                        message: "Barretenberg proof generation failed",
                        step: "proof_generation",
                        details: {
                            exitCode: proveResult.exitCode,
                            stdout: proveResult.stdout,
                            stderr: proveResult.stderr,
                        },
                    },
                }
            }

            // Verify all proof artifacts are created
            const targetFiles = await fs.readdir(this.targetPath)
            const requiredFiles = ["proof", "vk"]
            const missingFiles = []

            for (const file of requiredFiles) {
                if (!targetFiles.includes(file)) {
                    missingFiles.push(file)
                }
            }

            if (missingFiles.length > 0) {
                this.logger.directoryListing(this.targetPath, targetFiles)
                this.logger.stepError(
                    stepName,
                    new Error("Required proof artifacts not created"),
                    {
                        missingFiles,
                        filesFound: targetFiles,
                    }
                )

                return {
                    success: false,
                    error: {
                        type: "PROOF_GENERATION_FAILED",
                        message: "Required proof artifacts not created",
                        step: "proof_generation",
                        details: {
                            missingFiles,
                            filesFound: targetFiles,
                        },
                    },
                }
            }

            const duration = Date.now() - startTime
            this.logger.stepComplete(stepName, duration, {
                artifactsGenerated: requiredFiles,
            })

            return { success: true }
        } catch (error) {
            this.logger.stepError(stepName, error)

            return {
                success: false,
                error: {
                    type: "PROOF_GENERATION_FAILED",
                    message: error.message,
                    step: "proof_generation",
                },
            }
        }
    }

    /**
     * Execute complete proof workflow
     * @param {object} testConfig - Optional test configuration
     * @returns {Promise<{success: boolean, artifacts?: object, error?: object}>}
     */
    async executeProofWorkflow(testConfig = {}) {
        this.logger.info("========================================")
        this.logger.info("Starting ZKP Proof Generation Workflow")
        this.logger.info("========================================")

        const workflowStartTime = Date.now()
        const stepResults = {
            test_data_generation: { status: "pending" },
            compilation: { status: "pending" },
            witness_generation: { status: "pending" },
            proof_generation: { status: "pending" },
        }

        try {
            // Step 1: Generate test data
            this.logger.info("[STEP 1/4] Generating test data...")
            const step1Start = Date.now()
            stepResults.test_data_generation.status = "running"
            const testDataResult = await this.generateTestData(testConfig)

            if (!testDataResult.success) {
                stepResults.test_data_generation.status = "failed"
                stepResults.test_data_generation.error = testDataResult.error
                stepResults.test_data_generation.duration =
                    Date.now() - step1Start
                this.logWorkflowSummary(stepResults, workflowStartTime)
                return testDataResult
            }
            stepResults.test_data_generation.status = "success"
            stepResults.test_data_generation.duration = Date.now() - step1Start

            // Step 2: Compile circuit
            this.logger.info("[STEP 2/4] Compiling circuit...")
            const step2Start = Date.now()
            stepResults.compilation.status = "running"
            const compileResult = await this.compileCircuit()

            if (!compileResult.success) {
                stepResults.compilation.status = "failed"
                stepResults.compilation.error = compileResult.error
                stepResults.compilation.duration = Date.now() - step2Start
                this.logWorkflowSummary(stepResults, workflowStartTime)
                return compileResult
            }
            stepResults.compilation.status = "success"
            stepResults.compilation.duration = Date.now() - step2Start
            const bytecodeFile = compileResult.bytecodeFile

            // Step 3: Generate witness
            this.logger.info("[STEP 3/4] Generating witness...")
            const step3Start = Date.now()
            stepResults.witness_generation.status = "running"
            const witnessResult = await this.generateWitness()

            if (!witnessResult.success) {
                stepResults.witness_generation.status = "failed"
                stepResults.witness_generation.error = witnessResult.error
                stepResults.witness_generation.duration =
                    Date.now() - step3Start
                this.logWorkflowSummary(stepResults, workflowStartTime)
                return witnessResult
            }
            stepResults.witness_generation.status = "success"
            stepResults.witness_generation.duration = Date.now() - step3Start
            const witnessFile = witnessResult.witnessFile

            // Step 4: Generate proof
            this.logger.info("[STEP 4/4] Generating proof artifacts...")
            const step4Start = Date.now()
            stepResults.proof_generation.status = "running"
            const proofResult = await this.generateProofArtifacts(
                bytecodeFile,
                witnessFile
            )

            if (!proofResult.success) {
                stepResults.proof_generation.status = "failed"
                stepResults.proof_generation.error = proofResult.error
                stepResults.proof_generation.duration = Date.now() - step4Start
                this.logWorkflowSummary(stepResults, workflowStartTime)
                return proofResult
            }
            stepResults.proof_generation.status = "success"
            stepResults.proof_generation.duration = Date.now() - step4Start

            // Validate artifact completeness
            this.logger.info("Validating artifact completeness")
            const validation = await this.validateArtifacts()

            if (!validation.success) {
                this.logger.error(
                    "Artifact validation failed",
                    validation.error
                )
                this.logWorkflowSummary(stepResults, workflowStartTime)
                return validation
            }

            // Read proof artifacts
            const artifactsResult = await this.readProofArtifacts()

            if (!artifactsResult.success) {
                this.logger.error(
                    "Failed to read proof artifacts",
                    artifactsResult.error
                )
                this.logWorkflowSummary(stepResults, workflowStartTime)
                return artifactsResult
            }

            // Format proof data for contract submission
            const formattedData = this.formatProofForContract(
                artifactsResult.artifacts.proof,
                artifactsResult.artifacts.publicInputs
            )

            if (!formattedData.success) {
                this.logger.error(
                    "Failed to format proof data",
                    formattedData.error
                )
                this.logWorkflowSummary(stepResults, workflowStartTime)
                return formattedData
            }

            // Log workflow summary
            this.logWorkflowSummary(stepResults, workflowStartTime)

            this.logger.info("========================================")
            this.logger.info("✅ Proof Generation Workflow Completed")
            this.logger.info("========================================")

            return {
                success: true,
                proof: formattedData.proof,
                publicInputs: formattedData.publicInputs,
                artifacts: {
                    bytecode: artifactsResult.artifacts.bytecode,
                    verificationKey: artifactsResult.artifacts.verificationKey,
                },
            }
        } catch (error) {
            this.logger.error("FATAL ERROR: Unexpected error in workflow", {
                error: error.message,
                stack: error.stack,
            })

            this.logWorkflowSummary(stepResults, workflowStartTime)

            return {
                success: false,
                error: {
                    type: "WORKFLOW_ERROR",
                    message: error.message,
                    stack: error.stack,
                },
            }
        }
    }

    /**
     * Validate all required artifacts exist
     * @returns {Promise<{success: boolean, files?: object, error?: object}>}
     */
    async validateArtifacts() {
        try {
            const targetFiles = await fs.readdir(this.targetPath)
            const requiredArtifacts = {
                bytecode: targetFiles.find((f) => f.endsWith(".json")),
                witness: targetFiles.find((f) => f.endsWith(".gz")),
                verificationKey: targetFiles.includes("vk") ? "vk" : null,
                proof: targetFiles.includes("proof") ? "proof" : null,
            }

            const missingArtifacts = Object.entries(requiredArtifacts)
                .filter(([_, value]) => !value)
                .map(([key, _]) => key)

            if (missingArtifacts.length > 0) {
                this.logger.directoryListing(this.targetPath, targetFiles)
                this.logger.error("Missing required artifacts", {
                    missingArtifacts,
                    filesFound: targetFiles,
                })

                return {
                    success: false,
                    error: {
                        type: "ARTIFACT_VALIDATION_FAILED",
                        message: "Required artifacts missing",
                        details: {
                            missingArtifacts,
                            filesFound: targetFiles,
                        },
                    },
                }
            }

            this.logger.info(
                "All required artifacts present",
                requiredArtifacts
            )

            return {
                success: true,
                files: requiredArtifacts,
            }
        } catch (error) {
            this.logger.error("Artifact validation failed", {
                error: error.message,
            })

            return {
                success: false,
                error: {
                    type: "ARTIFACT_VALIDATION_FAILED",
                    message: error.message,
                },
            }
        }
    }

    /**
     * Format proof data for Solidity contract submission
     * @param {Buffer} proofData - Raw proof data buffer
     * @param {string[]} publicInputsArray - Array of public input hex strings
     * @returns {object} Formatted proof and public inputs for contract
     */
    formatProofForContract(proofData, publicInputsArray) {
        this.logger.info("Formatting proof data for contract")

        try {
            // Validate inputs
            if (!Buffer.isBuffer(proofData)) {
                throw new Error("Proof data must be a Buffer")
            }

            if (!Array.isArray(publicInputsArray)) {
                throw new Error("Public inputs must be an array")
            }

            // Convert proof buffer to hex string (Solidity bytes format)
            const proofHex = "0x" + proofData.toString("hex")
            this.logger.debug(
                `Formatted proof as bytes (${proofHex.length} chars)`
            )

            // Format public inputs as bytes32[] array
            const formattedPublicInputs = publicInputsArray.map(
                (input, index) => {
                    try {
                        // Remove 0x prefix if present
                        let hexValue = input.startsWith("0x")
                            ? input.slice(2)
                            : input

                        // Pad to 32 bytes (64 hex characters) if needed
                        hexValue = hexValue.padStart(64, "0")

                        // Validate hex string
                        if (!/^[0-9a-fA-F]{64}$/.test(hexValue)) {
                            throw new Error(
                                `Invalid hex format for public input at index ${index}: ${input}`
                            )
                        }

                        return "0x" + hexValue
                    } catch (error) {
                        throw new Error(
                            `Failed to format public input at index ${index}: ${error.message}`
                        )
                    }
                }
            )

            this.logger.debug(
                `Formatted ${formattedPublicInputs.length} public inputs as bytes32[]`
            )

            // Validate format compatibility with Solidity verify function signature
            // verify(bytes proof, bytes32[] publicInputs)
            const isValidFormat =
                typeof proofHex === "string" &&
                proofHex.startsWith("0x") &&
                Array.isArray(formattedPublicInputs) &&
                formattedPublicInputs.every(
                    (input) =>
                        typeof input === "string" &&
                        input.startsWith("0x") &&
                        input.length === 66 // 0x + 64 hex chars
                )

            if (!isValidFormat) {
                throw new Error("Formatted data does not match Solidity types")
            }

            this.logger.info("Data format validated for contract submission")

            return {
                success: true,
                proof: proofHex,
                publicInputs: formattedPublicInputs,
            }
        } catch (error) {
            this.logger.error("Failed to format proof data", {
                error: error.message,
            })

            return {
                success: false,
                error: {
                    type: "PROOF_FORMAT_FAILED",
                    message: "Failed to format proof data for contract",
                    details: {
                        error: error.message,
                    },
                },
            }
        }
    }

    /**
     * Read proof artifacts from target directory
     * @returns {Promise<{success: boolean, artifacts?: object, error?: object}>}
     */
    async readProofArtifacts() {
        this.logger.info("Reading proof artifacts")

        try {
            const artifacts = {}

            // Read proof file
            const proofPath = path.join(this.targetPath, "proof")
            try {
                const proofData = await fs.readFile(proofPath)
                artifacts.proof = proofData
                this.logger.debug(`Read proof file (${proofData.length} bytes)`)
            } catch (error) {
                this.logger.error("Failed to read proof file", {
                    file: "proof",
                    path: proofPath,
                    error: error.message,
                })

                return {
                    success: false,
                    error: {
                        type: "ARTIFACT_READ_FAILED",
                        message: "Failed to read proof file",
                        details: {
                            file: "proof",
                            path: proofPath,
                            error: error.message,
                        },
                    },
                }
            }

            // Read public inputs file and parse as array
            const publicInputsPath = path.join(this.targetPath, "public_inputs")
            try {
                const publicInputsData = await fs.readFile(publicInputsPath)
                // Public inputs are stored as binary data, 32 bytes per field element
                const publicInputsArray = []
                const fieldElementSize = 32 // bytes32 in Solidity

                for (
                    let i = 0;
                    i < publicInputsData.length;
                    i += fieldElementSize
                ) {
                    const fieldElement = publicInputsData.slice(
                        i,
                        i + fieldElementSize
                    )
                    if (fieldElement.length === fieldElementSize) {
                        // Convert to hex string
                        publicInputsArray.push(fieldElement.toString("hex"))
                    }
                }

                artifacts.publicInputs = publicInputsArray
                this.logger.debug(
                    `Read public inputs (${publicInputsArray.length} inputs)`
                )
            } catch (error) {
                this.logger.error("Failed to read public inputs file", {
                    file: "public_inputs",
                    path: publicInputsPath,
                    error: error.message,
                })

                return {
                    success: false,
                    error: {
                        type: "ARTIFACT_READ_FAILED",
                        message: "Failed to read public inputs file",
                        details: {
                            file: "public_inputs",
                            path: publicInputsPath,
                            error: error.message,
                        },
                    },
                }
            }

            // Read verification key file
            const vkPath = path.join(this.targetPath, "vk")
            try {
                const vkData = await fs.readFile(vkPath)
                artifacts.verificationKey = vkData
                this.logger.debug(
                    `Read verification key (${vkData.length} bytes)`
                )
            } catch (error) {
                this.logger.error("Failed to read verification key file", {
                    file: "vk",
                    path: vkPath,
                    error: error.message,
                })

                return {
                    success: false,
                    error: {
                        type: "ARTIFACT_READ_FAILED",
                        message: "Failed to read verification key file",
                        details: {
                            file: "vk",
                            path: vkPath,
                            error: error.message,
                        },
                    },
                }
            }

            // Read bytecode file
            const targetFiles = await fs.readdir(this.targetPath)
            const bytecodeFile = targetFiles.find((f) => f.endsWith(".json"))

            if (bytecodeFile) {
                const bytecodePath = path.join(this.targetPath, bytecodeFile)
                try {
                    const bytecodeData = await fs.readFile(
                        bytecodePath,
                        "utf-8"
                    )
                    artifacts.bytecode = bytecodeData
                    this.logger.debug(`Read bytecode file (${bytecodeFile})`)
                } catch (error) {
                    this.logger.error("Failed to read bytecode file", {
                        file: bytecodeFile,
                        path: bytecodePath,
                        error: error.message,
                    })

                    return {
                        success: false,
                        error: {
                            type: "ARTIFACT_READ_FAILED",
                            message: "Failed to read bytecode file",
                            details: {
                                file: bytecodeFile,
                                path: bytecodePath,
                                error: error.message,
                            },
                        },
                    }
                }
            }

            this.logger.info("All artifacts read successfully")

            return {
                success: true,
                artifacts,
            }
        } catch (error) {
            this.logger.error("Unexpected error reading artifacts", {
                error: error.message,
            })

            return {
                success: false,
                error: {
                    type: "ARTIFACT_READ_FAILED",
                    message: error.message,
                },
            }
        }
    }

    /**
     * Log workflow summary
     * @param {object} stepResults - Results of each workflow step
     * @param {number} startTime - Workflow start timestamp
     */
    logWorkflowSummary(stepResults, startTime) {
        const totalDuration = Date.now() - startTime

        this.logger.info("========================================")
        this.logger.info("Workflow Summary")
        this.logger.info("========================================")

        const steps = [
            { name: "Test Data Generation", key: "test_data_generation" },
            { name: "Circuit Compilation", key: "compilation" },
            { name: "Witness Generation", key: "witness_generation" },
            { name: "Proof Generation", key: "proof_generation" },
        ]

        steps.forEach((step, index) => {
            const result = stepResults[step.key]
            const statusIcon =
                result.status === "success"
                    ? "✅"
                    : result.status === "failed"
                    ? "❌"
                    : result.status === "running"
                    ? "🔄"
                    : "⏸️"

            const stepDuration = result.duration
                ? ` (${(result.duration / 1000).toFixed(2)}s)`
                : ""

            this.logger.info(
                `${index + 1}. ${step.name}: ${statusIcon} ${
                    result.status
                }${stepDuration}`
            )

            // Log error details if step failed
            if (result.status === "failed" && result.error) {
                this.logger.error(
                    `   Error: ${result.error.message || result.error.type}`,
                    {
                        details: result.error.details,
                    }
                )
            }
        })

        this.logger.info(
            `Total execution time: ${(totalDuration / 1000).toFixed(2)}s`
        )
        this.logger.info("========================================")

        // Use the structured workflowSummary method for detailed logging
        this.logger.workflowSummary(stepResults, totalDuration)
    }

    /**
     * Generate proof from test data
     * POST /api/proof/generate
     */
    async generateProof(req, res) {
        try {
            const testConfig = req.body.testConfig || {}

            this.logger.info("API: Received proof generation request", {
                testConfig,
            })
            const result = await this.executeProofWorkflow(testConfig)

            if (!result.success) {
                return res.status(400).json(result)
            }

            return res.status(200).json(result)
        } catch (error) {
            this.logger.error("API: Error in generateProof endpoint", {
                error: error.message,
                stack: error.stack,
            })

            res.status(500).json({
                success: false,
                error: {
                    type: "INTERNAL_ERROR",
                    message: error.message,
                },
            })
        }
    }

    /**
     * Generate proof for a specific user
     * POST /api/proof/generate-user
     * Body: { user_id: number, org_id: number, isKYCed: boolean }
     */
    async generateUserProof(req, res) {
        try {
            const { user_id, org_id, isKYCed } = req.body

            // Validate required fields
            if (!user_id || !org_id || isKYCed === undefined) {
                return res.status(400).json({
                    success: false,
                    error: {
                        type: "INVALID_PARAMETERS",
                        message:
                            "Missing required fields: user_id, org_id, isKYCed",
                        details: { user_id, org_id, isKYCed },
                    },
                })
            }

            this.logger.info("API: Received user proof generation request", {
                user_id,
                org_id,
                isKYCed,
            })

            const result = await this.generateProofService(
                user_id,
                org_id,
                isKYCed
            )

            if (!result.success) {
                return res.status(400).json(result)
            }

            return res.status(200).json(result)
        } catch (error) {
            this.logger.error("API: Error in generateUserProof endpoint", {
                error: error.message,
                stack: error.stack,
            })

            res.status(500).json({
                success: false,
                error: {
                    type: "INTERNAL_ERROR",
                    message: error.message,
                },
            })
        }
    }

    /**
     * Call contract verification with proof data
     * @param {string} proof - Hex-encoded proof bytes
     * @param {string[]} publicInputs - Array of bytes32 public inputs
     * @returns {Promise<{success: boolean, verified?: boolean, transactionHash?: string, gasUsed?: string, error?: object}>}
     */
    async callContractVerification(proof, publicInputs) {
        this.logger.info("Contract Verification")

        try {
            // Validate inputs
            if (!proof || typeof proof !== "string") {
                throw new Error("Invalid proof: must be a hex string")
            }

            if (!Array.isArray(publicInputs)) {
                throw new Error("Invalid public inputs: must be an array")
            }

            // Validate proof format
            if (!proof.startsWith("0x")) {
                throw new Error("Proof must start with 0x prefix")
            }

            // Validate public inputs format
            for (let i = 0; i < publicInputs.length; i++) {
                const input = publicInputs[i]
                if (
                    typeof input !== "string" ||
                    !input.startsWith("0x") ||
                    input.length !== 66
                ) {
                    throw new Error(
                        `Invalid public input at index ${i}: must be 0x-prefixed 32-byte hex string (66 chars)`
                    )
                }
            }

            this.logger.debug("Input validation passed")

            // Initialize provider if not already done
            if (!this.provider || !this.wallet) {
                this.logger.info("Initializing provider and wallet...")
                const initResult = await this.initializeProvider()
                if (!initResult.success) {
                    return initResult
                }
            }

            // Import HonkVerifier model
            const { HonkVerifier } = require("../models/honk-verifier")
            const verifier = new HonkVerifier()

            // Get contract instance
            this.logger.info("Creating contract instance")
            const contract = verifier.getContract(this.provider)

            this.logger.info("Calling verify function", {
                contractAddress: verifier.address,
                proofLength: proof.length,
                publicInputsCount: publicInputs.length,
            })

            // Log the actual data being sent (first 100 chars of proof)
            this.logger.debug("Proof data preview", {
                proofStart: proof.substring(0, 100),
                publicInputs: publicInputs,
            })

            // Call verify function (this is a view function, so no transaction is sent)
            try {
                this.logger.info("Executing contract.verify()...")
                const verified = await contract.verify(proof, publicInputs)

                this.logger.info(
                    `Verification completed: ${verified ? "VALID" : "INVALID"}`
                )

                return {
                    success: true,
                    verified: verified,
                }
            } catch (contractError) {
                // Parse contract revert errors
                this.logger.error("Contract call reverted", {
                    error: contractError.message,
                    stack: contractError.stack,
                })

                // Extract error type from contract revert
                let errorType = "UNKNOWN_ERROR"
                let revertReason = contractError.message

                // Check for specific contract errors
                if (contractError.message.includes("ConsistencyCheckFailed")) {
                    errorType = "CONSISTENCY_CHECK_FAILED"
                    revertReason = "Proof consistency validation failed"
                } else if (contractError.message.includes("ProofLengthWrong")) {
                    errorType = "PROOF_LENGTH_WRONG"
                    revertReason = "Proof data has incorrect length"
                } else if (
                    contractError.message.includes("PublicInputsLengthWrong")
                ) {
                    errorType = "PUBLIC_INPUTS_LENGTH_WRONG"
                    revertReason = "Public inputs array has incorrect length"
                } else if (contractError.message.includes("SumcheckFailed")) {
                    errorType = "SUMCHECK_FAILED"
                    revertReason = "Sumcheck protocol failed"
                } else if (contractError.message.includes("ShpleminiFailed")) {
                    errorType = "SHPLEMINI_FAILED"
                    revertReason = "Shplemini verification failed"
                } else if (
                    contractError.message.includes("GeminiChallengeInSubgroup")
                ) {
                    errorType = "GEMINI_CHALLENGE_IN_SUBGROUP"
                    revertReason = "Invalid Gemini challenge"
                }

                return {
                    success: false,
                    error: {
                        type: errorType,
                        message: "Contract verification failed",
                        revertReason: revertReason,
                        details: {
                            originalError: contractError.message,
                            code: contractError.code,
                        },
                    },
                }
            }
        } catch (error) {
            this.logger.error("Unexpected error in contract verification", {
                error: error.message,
            })

            return {
                success: false,
                error: {
                    type: "VERIFICATION_ERROR",
                    message: "Failed to verify proof",
                    details: {
                        error: error.message,
                    },
                },
            }
        }
    }

    /**
     * Generate proof for a specific user
     *
     * Flow:
     * 1. Get batch equation from user_id (via batch_id)
     * 2. Get org_salt and wallet_address from org_id
     * 3. Fix equation format if needed
     * 4. Hash the equation using Poseidon2
     * 5. Get zkp_key from user and generate secret
     * 6. Generate nullifier (Poseidon hash of secret and wallet address)
     * 7. Generate proof and public inputs
     *
     * @param {number} user_id - User ID
     * @param {number} org_id - Organization ID
     * @param {boolean} isKYCed - KYC status
     * @returns {Promise<{success: boolean, proof?: string, publicInputs?: string[], error?: object}>}
     */
    async generateProofService(user_id, org_id, isKYCed) {
        this.logger.info("Starting proof generation service", {
            user_id,
            org_id,
            isKYCed,
        })

        try {
            // Step 1 & 2: Get user, batch, and organization data
            const dataResult = await userManagementService.getUserProofData(
                user_id,
                org_id
            )

            if (!dataResult.success) {
                this.logger.error(
                    "Failed to get user proof data",
                    dataResult.error
                )
                return dataResult
            }

            const { user, batch, organization } = dataResult.data

            this.logger.info("Retrieved user proof data", {
                user_id: user.user_id,
                batch_id: batch._id,
                org_id: organization.org_id,
            })

            // Step 3: Fix equation format (convert string array to BigInt array)
            const equationStrings = batch.equation
            let polynomial = stringsToBigInts(equationStrings)

            // Pad polynomial to MAX_POLY_DEGREE if needed
            while (polynomial.length <= MAX_POLY_DEGREE) {
                polynomial.push(0n)
            }

            // Ensure all coefficients are in canonical form (0 <= x < FIELD_PRIME)
            const FIELD_PRIME =
                21888242871839275222246405745257275088548364400416034343698204186575808495617n
            polynomial = polynomial.map((coeff) => {
                const r = coeff % FIELD_PRIME
                return r >= 0n ? r : r + FIELD_PRIME
            })

            this.logger.info("Polynomial prepared", {
                degree: polynomial.length - 1,
                coefficientsCount: polynomial.length,
            })

            // Step 4: Hash the equation using Poseidon2
            const polynomialHash = poseidon2Hash(polynomial)
            this.logger.info("Polynomial hash generated", {
                hash: polynomialHash.toString(),
            })

            // Step 5: Get zkp_key (email) and generate secret
            const zkp_key = user.zkp_key // This is the email
            const secret = generateUserSecret(zkp_key, organization.org_salt)

            this.logger.info("User secret generated", {
                zkp_key,
            })

            // Step 6: Generate verifier_key (wallet address as hash) and nullifier
            const crypto = require("crypto")
            const verifierKeyHash = crypto
                .createHash("sha256")
                .update(organization.wallet_address)
                .digest("hex")
            const verifierKey = BigInt("0x" + verifierKeyHash) % FIELD_PRIME

            const nullifier = poseidon2Hash([secret, verifierKey])

            this.logger.info("Nullifier generated", {
                verifierKey: verifierKey.toString(),
                nullifier: nullifier.toString(),
            })

            // Step 7: Create test config and generate proof
            const testConfig = {
                isKYCed,
                nullifier,
                polynomial,
                polynomialHash,
                secret,
                verifierKey,
            }

            this.logger.info("Executing proof workflow with generated config")

            // Use the existing executeProofWorkflow with our custom testConfig
            const proofResult = await this.executeProofWorkflow(testConfig)

            if (!proofResult.success) {
                this.logger.error("Proof generation failed", proofResult.error)
                return proofResult
            }

            this.logger.info("Proof generation completed successfully")

            return {
                success: true,
                proof: proofResult.proof,
                publicInputs: proofResult.publicInputs,
                artifacts: proofResult.artifacts,
            }
        } catch (error) {
            this.logger.error("Error in generateProofService", {
                error: error.message,
                stack: error.stack,
            })

            return {
                success: false,
                error: {
                    type: "PROOF_SERVICE_ERROR",
                    message: "Failed to generate proof for user",
                    details: {
                        error: error.message,
                        user_id,
                        org_id,
                    },
                },
            }
        }
    }

    /**
     * Verify proof against on-chain contract
     * POST /api/proof/verify
     * Supports optional file uploads or reads from default target directory
     */
    async verifyProof(req, res) {
        try {
            this.logger.info("API: Received proof verification request")

            let proofBuffer = null
            let publicInputsBuffer = null
            let source = "default_target_directory"

            // Check if files were uploaded via multipart/form-data
            if (req.files) {
                if (req.files.proof && req.files.proof[0]) {
                    proofBuffer = req.files.proof[0].buffer
                    this.logger.info(
                        `Proof file uploaded (${proofBuffer.length} bytes)`
                    )
                    source = "uploaded_files"
                }

                if (req.files.public_inputs && req.files.public_inputs[0]) {
                    publicInputsBuffer = req.files.public_inputs[0].buffer
                    this.logger.info(
                        `Public inputs file uploaded (${publicInputsBuffer.length} bytes)`
                    )
                    source = "uploaded_files"
                }
            }

            // If files were not uploaded, read from default target directory
            if (!proofBuffer || !publicInputsBuffer) {
                this.logger.info(
                    "Files not uploaded, reading from default target directory"
                )

                const artifactsResult = await this.readProofArtifacts()

                if (!artifactsResult.success) {
                    this.logger.error(
                        "Failed to read proof artifacts from filesystem",
                        artifactsResult.error
                    )
                    return res.status(400).json(artifactsResult)
                }

                // Use uploaded files if available, otherwise use filesystem files
                proofBuffer = proofBuffer || artifactsResult.artifacts.proof
                publicInputsBuffer =
                    publicInputsBuffer || artifactsResult.artifacts.publicInputs

                // Parse public inputs if from filesystem (already parsed)
                if (!req.files || !req.files.public_inputs) {
                    // publicInputsBuffer is already an array from readProofArtifacts
                    const formattedData = this.formatProofForContract(
                        proofBuffer,
                        publicInputsBuffer
                    )

                    if (!formattedData.success) {
                        this.logger.error(
                            "Failed to format proof data",
                            formattedData.error
                        )
                        return res.status(400).json(formattedData)
                    }

                    this.logger.info("Proof artifacts loaded", {
                        source,
                        proofSize: proofBuffer.length,
                        publicInputsCount: publicInputsBuffer.length,
                    })

                    // Call contract verification
                    const result = await this.callContractVerification(
                        formattedData.proof,
                        formattedData.publicInputs
                    )

                    if (!result.success) {
                        return res.status(400).json(result)
                    }

                    return res.status(200).json(result)
                }
            }

            // Parse uploaded public inputs buffer
            const publicInputsArray = []
            const fieldElementSize = 32 // bytes32 in Solidity

            for (
                let i = 0;
                i < publicInputsBuffer.length;
                i += fieldElementSize
            ) {
                const fieldElement = publicInputsBuffer.slice(
                    i,
                    i + fieldElementSize
                )
                if (fieldElement.length === fieldElementSize) {
                    publicInputsArray.push(fieldElement.toString("hex"))
                }
            }

            // Log parsed public inputs for debugging
            this.logger.info("Parsed public inputs from uploaded file", {
                count: publicInputsArray.length,
                sample: publicInputsArray.slice(0, 2),
            })

            // Format proof data for contract submission
            const formattedData = this.formatProofForContract(
                proofBuffer,
                publicInputsArray
            )

            if (!formattedData.success) {
                this.logger.error(
                    "Failed to format proof data",
                    formattedData.error
                )
                return res.status(400).json(formattedData)
            }

            this.logger.info("Proof artifacts loaded", {
                source,
                proofSize: proofBuffer.length,
                publicInputsCount: publicInputsArray.length,
            })

            this.logger.info("Formatted data ready for contract", {
                proofLength: formattedData.proof.length,
                publicInputsCount: formattedData.publicInputs.length,
                publicInputsSample: formattedData.publicInputs.slice(0, 2),
            })

            // Call contract verification
            const result = await this.callContractVerification(
                formattedData.proof,
                formattedData.publicInputs
            )

            if (!result.success) {
                return res.status(400).json(result)
            }

            return res.status(200).json(result)
        } catch (error) {
            this.logger.error("API: Error in verifyProof endpoint", {
                error: error.message,
                stack: error.stack,
            })

            res.status(500).json({
                success: false,
                error: {
                    type: "INTERNAL_ERROR",
                    message: error.message,
                },
            })
        }
    }
}

module.exports = ProofController
