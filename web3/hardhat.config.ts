import type { HardhatUserConfig } from "hardhat/config"
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem"
import hardhatVerify from "@nomicfoundation/hardhat-verify"
import * as dotenv from "dotenv";
dotenv.config();

const SepoliaRPC = process.env.SEPOLIA_RPC_URL || ""
const SepoliaPrivateKey = process.env.SEPOLIA_PRIVATE_KEY || ""
const EtherscanAPIKey = process.env.ETHERSCAN_API_KEY || ""

const config: HardhatUserConfig = {
    plugins: [hardhatToolboxViemPlugin, hardhatVerify],
    solidity: {
        profiles: {
            default: {
                version: "0.8.28",
            },
            production: {
                version: "0.8.28",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        },
    },
    networks: {
        hardhatMainnet: {
            type: "edr-simulated",
            chainType: "l1",
        },
        hardhatOp: {
            type: "edr-simulated",
            chainType: "op",
        },
        sepolia: {
            type: "http",
            chainType: "l1",
            url: SepoliaRPC,
            accounts: [SepoliaPrivateKey],
        },
    },
    verify: {
        etherscan: {
            apiKey: EtherscanAPIKey,
        },
    },
}

export default config
