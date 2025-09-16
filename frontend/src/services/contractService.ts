import { ethers } from 'ethers';
import { contractAddresses } from '../contracts/addresses';

const FINCUBE_ERC20_ABI = [

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "symbol",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "initialSupply",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "allowance",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "needed",
                "type": "uint256"
            }
        ],
        "name": "ERC20InsufficientAllowance",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "sender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "balance",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "needed",
                "type": "uint256"
            }
        ],
        "name": "ERC20InsufficientBalance",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "approver",
                "type": "address"
            }
        ],
        "name": "ERC20InvalidApprover",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            }
        ],
        "name": "ERC20InvalidReceiver",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "sender",
                "type": "address"
            }
        ],
        "name": "ERC20InvalidSender",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "ERC20InvalidSpender",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
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
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
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
            }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
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
        "name": "symbol",
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
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
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
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

export class ContractService {
    private signer: ethers.Signer;
    private fincubeERC20: ethers.Contract;

    constructor(signer: ethers.Signer) {
        this.signer = signer;

        this.fincubeERC20 = new ethers.Contract(contractAddresses.fincubeERC20, FINCUBE_ERC20_ABI, signer);
    }

    // ERC20 Functions
    async getBalance(address: string): Promise<string> {
        const balance = await this.fincubeERC20.balanceOf(address);
        return ethers.utils.formatEther(balance);
    }

    async transfer(to: string, amount: string): Promise<ethers.ContractTransaction> {
        const normalized = amount.trim().replace(/,/g, '');
        if (!/^\d*\.?\d+$/.test(normalized)) {
            throw new Error('Please enter a valid decimal amount');
        }
        const parsedAmount = ethers.utils.parseEther(normalized);

        // Preflight: ensure we have enough ETH to pay gas
        const signer = this.signer as ethers.Signer;
        const provider = (signer.provider as ethers.providers.Provider);
        const from = await signer.getAddress();

        // Estimate gas and fee
        let gasEstimate: ethers.BigNumber;
        try {
            gasEstimate = await this.fincubeERC20.estimateGas.transfer(to, parsedAmount);
        } catch (err: any) {
            // Surface common ERC20 errors
            const msg = (err?.error?.message || err?.message || '').toLowerCase();
            if (msg.includes('insufficient balance')) {
                throw new Error('Token balance is insufficient for this transfer.');
            }
            if (msg.includes('transfer amount exceeds balance')) {
                throw new Error('Transfer amount exceeds your token balance.');
            }
            if (msg.includes('execution reverted')) {
                throw new Error('Transaction would revert. Check recipient and amount.');
            }
            // Fallback
            throw new Error('Failed to estimate gas. The transaction may revert.');
        }

        const feeData = await (provider as ethers.providers.BaseProvider).getFeeData();
        // Prefer EIP-1559 fees if available
        const gasLimit = gasEstimate.mul(120).div(100);
        const price = feeData.maxFeePerGas || feeData.gasPrice;
        if (price) {
            const requiredWei = gasLimit.mul(price);
            const ethBalance = await provider.getBalance(from);
            if (ethBalance.lt(requiredWei)) {
                const neededEth = ethers.utils.formatEther(requiredWei.sub(ethBalance).abs());
                throw new Error(`Insufficient ETH for gas. You need approximately +${neededEth} ETH more to cover fees.`);
            }
        }

        // Send with the buffered gas limit
        try {
            return await this.fincubeERC20.transfer(to, parsedAmount, { gasLimit });
        } catch (err: any) {
            const msg = (err?.error?.message || err?.message || '').toLowerCase();
            if (msg.includes('insufficient funds')) {
                throw new Error('Insufficient ETH for gas. Please add some ETH to your wallet.');
            }
            if (msg.includes('user rejected')) {
                throw new Error('Transaction rejected in wallet.');
            }
            if (msg.includes('execution reverted')) {
                throw new Error('Transaction reverted by the contract.');
            }
            throw err;
        }
    }


}