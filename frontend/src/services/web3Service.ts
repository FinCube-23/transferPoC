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