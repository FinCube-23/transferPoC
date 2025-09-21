import { ethers, BigNumber } from 'ethers';
import { contractAddresses } from '../contracts/addresses';
const FINCUBE_ABI =   [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "target",
          "type": "address"
        }
      ],
      "name": "AddressEmptyCode",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "implementation",
          "type": "address"
        }
      ],
      "name": "ERC1967InvalidImplementation",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ERC1967NonPayable",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "FailedCall",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidInitialization",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NotInitializing",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ReentrancyGuardReentrantCall",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        }
      ],
      "name": "SafeERC20FailedOperation",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "UUPSUnauthorizedCallContext",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "slot",
          "type": "bytes32"
        }
      ],
      "name": "UUPSUnsupportedProxiableUUID",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "newToken",
          "type": "address"
        }
      ],
      "name": "ApprovedERC20Updated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "newDAO",
          "type": "address"
        }
      ],
      "name": "DAOUpdated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint64",
          "name": "version",
          "type": "uint64"
        }
      ],
      "name": "Initialized",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "memo",
          "type": "string"
        }
      ],
      "name": "StablecoinTransfer",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "implementation",
          "type": "address"
        }
      ],
      "name": "Upgraded",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "UPGRADE_INTERFACE_VERSION",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "approvedERC20",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "dao",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_dao",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_token",
          "type": "address"
        }
      ],
      "name": "initialize",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "proxiableUUID",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "memo",
          "type": "string"
        },
        {
          "internalType": "bytes32",
          "name": "nullifier",
          "type": "bytes32"
        }
      ],
      "name": "safeTransfer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newToken",
          "type": "address"
        }
      ],
      "name": "setApprovedERC20",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newDAO",
          "type": "address"
        }
      ],
      "name": "setDAO",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newImplementation",
          "type": "address"
        },
        {
          "internalType": "bytes",
          "name": "data",
          "type": "bytes"
        }
      ],
      "name": "upgradeToAndCall",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    } 
  ]
export class ContractService {
    private signer: ethers.Signer;
    private fincube: ethers.Contract;
    constructor(signer: ethers.Signer) {
        this.signer = signer;
        this.fincube = new ethers.Contract(contractAddresses.finCube, FINCUBE_ABI, signer);
    }

    async safeTransfer(
        to: string,
        amount: BigNumber, // amount should already be in raw token units
        memo: string,
        nullifier: string
    ): Promise<ethers.ContractTransaction> {
        // Ensure memo is provided
        memo = memo || "No memo";
        
        try {
            // Use a fixed gas limit to avoid estimation errors
            const gasLimit = ethers.BigNumber.from(1000000);
            
            // Verify nullifier is valid bytes32 format
            if (nullifier.length !== 66 || !nullifier.startsWith('0x')) {
                console.error("Invalid nullifier format:", nullifier);
                throw new Error("Nullifier must be a valid bytes32 value (0x + 64 hex chars)");
            }
            
            // Log transaction parameters for debugging
            console.log("⚡ Executing safeTransfer with parameters:");
            console.log("1. to:", to);
            console.log("2. amount:", amount.toString());
            console.log("3. memo:", memo);
            console.log("4. nullifier:", nullifier);
            
            // For debugging: Log the exact parameters being passed to the contract
            console.log("Raw parameters:", [to, amount, memo, nullifier]);
            
            // IMPORTANT: Pass parameters exactly as expected by the contract function
            // The order matters! DO NOT include any transaction overrides in the parameter list
            const tx = await this.fincube.safeTransfer(
                to,         // address to
                amount,     // uint256 amount
                memo,       // string calldata memo
                nullifier,  // bytes32 nullifier
                { gasLimit } // Transaction overrides - separate from function parameters
            );
            
            console.log("Transaction sent:", tx.hash);
            return tx;
        } catch (error) {
            console.error("Transaction error:", error);
            throw error;
        }
    }

}