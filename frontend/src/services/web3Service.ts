import { BigNumber, ethers } from 'ethers';
import { ContractService } from './contractService';

declare global {
    interface Window {
        ethereum: any;
    }
}
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];


export class Web3Service {
    private provider: ethers.providers.Web3Provider | null = null;
    private signer: ethers.Signer | null = null;
    private contractService: ContractService | null = null;

    async connect(): Promise<void> {
        if (typeof window.ethereum === 'undefined') {
            throw new Error('MetaMask is not installed');
        }
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        this.signer = this.provider.getSigner();
        this.contractService = new ContractService(this.signer);
    }

    async getAccounts(): Promise<string[]> {
        if (!this.provider) throw new Error('Not connected to Web3');
        return await this.provider.listAccounts();
    }

    async getUsdcBalance(address: string): Promise<string> {
        if (!this.signer) throw new Error("Not connected");

        const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; 
        const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.signer);

        const balance = await usdc.balanceOf(address);
        const decimals = await usdc.decimals();
        return ethers.utils.formatUnits(balance, decimals);
    }


    async getEthBalance(address: string): Promise<ethers.BigNumber> {
        if (!this.provider) throw new Error('Not connected to Web3');
        return await this.provider.getBalance(address);
    }

    // Minimal safeTransfer call
 async safeTransfer(to: string, amount: BigNumber, memo: string, nullifier: string): Promise<ethers.ContractTransaction> {
    if (!this.contractService) throw new Error('Not connected to Web3');
    return await this.contractService.safeTransfer(to, amount, memo, nullifier);
}


    async transferEth(to: string, amount: string): Promise<ethers.providers.TransactionResponse> {
        if (!this.provider || !this.signer) throw new Error('Not connected to Web3');
        const value = ethers.utils.parseEther(amount);
        return await this.signer.sendTransaction({ to, value });
    }

    isConnected(): boolean {
        return !!this.provider && !!this.signer;
    }

    disconnect(): void {
        this.provider = null;
        this.signer = null;
        this.contractService = null;
    }
}

export const web3Service = new Web3Service();
