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
    try {
        console.log(`🔄 Web3Service: Processing transfer to ${to}`);
        console.log(`💰 Amount: ${ethers.utils.formatUnits(amount, 6)} USDC`);
        console.log(`🔑 Using bytes32 nullifier: ${nullifier}`);
        
        // Double-check nullifier format (must be bytes32)
        if (!nullifier || !nullifier.startsWith('0x') || nullifier.length !== 66) {
            console.error("❌ ERROR: Invalid nullifier format:", nullifier);
            console.error("Nullifier must be exactly 32 bytes (64 hex chars + 0x prefix)");
            throw new Error("Invalid bytes32 nullifier format");
        }
        
        // Get user's address for transaction context
        const userAddress = await this.provider!.getSigner().getAddress();
        console.log("👤 Sender address:", userAddress);
        
        // Check USDC balance before attempting transfer
        try {
            const usdcBalance = await this.getUsdcBalance(userAddress);
            const parsedBalance = ethers.utils.parseUnits(usdcBalance, 6);
            console.log("Current USDC balance:", usdcBalance);
            
            if (parsedBalance.lt(amount)) {
                throw new Error(`Insufficient USDC balance. You have ${usdcBalance} USDC but attempting to send ${ethers.utils.formatUnits(amount, 6)} USDC.`);
            }
        } catch (balanceError) {
            console.error("Failed to check balance:", balanceError);
            // Continue anyway, the contract will check this too
        }
        
        // Execute the transfer
        return await this.contractService.safeTransfer(to, amount, memo, nullifier);
    } catch (error: any) {
        console.error("Web3Service: Transfer failed", error);
        
        // Try to extract meaningful error message
        let errorMessage = "Transfer failed: ";
        
        if (typeof error === "object" && error !== null) {
            if (error.message) {
                errorMessage += error.message;
            } else if (error.reason) {
                errorMessage += error.reason;
            }
            
            // Handle specific error cases
            if (error.code === "ACTION_REJECTED") {
                errorMessage = "You rejected the transaction in your wallet.";
            } else if (error.code === "UNPREDICTABLE_GAS_LIMIT" && error.error) {
                errorMessage += ` (${error.error.message || "Contract execution would fail"})`;
            }
        }
        
        const enhancedError = new Error(errorMessage);
        (enhancedError as any).originalError = error;
        throw enhancedError;
    }
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
