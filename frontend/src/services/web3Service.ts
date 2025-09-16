import { ethers } from 'ethers';
import { ContractService } from './contractService';

declare global {
    interface Window {
        ethereum: any;
    }
}

export class Web3Service {
    private provider: ethers.providers.Web3Provider | null = null;
    private signer: ethers.Signer | null = null;
    private contractService: ContractService | null = null;

    async connect(): Promise<void> {
        if (typeof window.ethereum === 'undefined') {
            throw new Error('MetaMask is not installed');
        }
        // Always request accounts, forcing MetaMask popup
        await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        this.signer = this.provider.getSigner();
        this.contractService = new ContractService(this.signer);
    }

    async getAccounts(): Promise<string[]> {
        if (!this.provider) {
            throw new Error('Not connected to Web3');
        }
        return await this.provider.listAccounts();
    }

    async getBalance(address: string): Promise<string> {
        if (!this.contractService) {
            throw new Error('Not connected to Web3');
        }
        return await this.contractService.getBalance(address);
    }

    async getEthBalance(address: string): Promise<ethers.BigNumber> {
        if (!this.provider) {
            throw new Error('Not connected to Web3');
        }
        return await this.provider.getBalance(address);
    }

    async transfer(to: string, amount: string): Promise<ethers.ContractTransaction> {
        if (!this.contractService) {
            throw new Error('Not connected to Web3');
        }
        return await this.contractService.transfer(to, amount);
    }

    // Send native ETH transfer with preflight checks
    async transferEth(to: string, amount: string): Promise<ethers.providers.TransactionResponse> {
        if (!this.provider || !this.signer) {
            throw new Error('Not connected to Web3');
        }
        const normalized = (amount || '').trim().replace(/,/g, '');
        if (!/^\d*\.?\d+$/.test(normalized)) {
            throw new Error('Please enter a valid decimal amount');
        }
        const value = ethers.utils.parseEther(normalized);
        if (value.lte(0)) {
            throw new Error('Amount must be greater than 0');
        }
        const from = await this.signer.getAddress();
        const provider = this.provider;
        // Estimate gas
        let gasLimit: ethers.BigNumber;
        try {
            gasLimit = await provider.estimateGas({ from, to, value });
        } catch (err: any) {
            throw new Error('Failed to estimate gas for ETH transfer.');
        }
        // Fee data
        const feeData = await provider.getFeeData();
        const price = feeData.maxFeePerGas || feeData.gasPrice;
        const bufferedGasLimit = gasLimit.mul(120).div(100);
        const requiredForGas = price ? bufferedGasLimit.mul(price) : ethers.BigNumber.from(0);
        const balance = await provider.getBalance(from);
        // Ensure enough for value + gas
        const totalRequired = requiredForGas.add(value);
        if (balance.lt(totalRequired)) {
            const shortEth = ethers.utils.formatEther(totalRequired.sub(balance));
            throw new Error(`Insufficient ETH. Need approximately +${shortEth} ETH to cover value + gas.`);
        }
        // Send
        return await this.signer.sendTransaction({ to, value, gasLimit: bufferedGasLimit, ...(feeData.maxFeePerGas ? { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined } : {}) });
    }

    isConnected(): boolean {
        return this.provider !== null && this.signer !== null;
    }

    disconnect(): void {
        // MetaMask doesn't support programmatic disconnect; clear local references
        this.provider = null;
        this.signer = null;
        this.contractService = null;
    }
}

// Create singleton instance
export const web3Service = new Web3Service();