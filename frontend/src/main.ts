import './styles/main.css';
import { web3Service } from './services/web3Service';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// DOM Elements
const connectBtn = document.getElementById('connect-wallet') as HTMLButtonElement;
const walletStatus = document.getElementById('wallet-status') as HTMLDivElement;
const transferForm = document.getElementById('transfer-form') as HTMLFormElement;
const usdBalanceEl = document.getElementById('usd-balance') as HTMLDivElement;
const ethBalanceEl = document.getElementById('eth-balance') as HTMLDivElement;
const usdcBalanceEl = document.getElementById('usdc-balance') as HTMLDivElement | null;
const txRows = document.getElementById('tx-rows') as HTMLDivElement;
const authSection = document.getElementById('auth-section') as HTMLDivElement;
const signInBtn = document.getElementById('sign-in') as HTMLButtonElement;
const signInTopBtn = document.getElementById('sign-in-top') as HTMLButtonElement;
const authModalEl = document.getElementById('auth-modal') as HTMLDivElement | null;
const signOutBtn = document.getElementById('sign-out') as HTMLButtonElement;
const signinCenter = document.getElementById('signin-center') as HTMLDivElement;

type TxRecord = { sender: string; recipient: string; amount: string; timestamp: number };
const recentTxs: TxRecord[] = [];

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function renderRecentTxs(): void {
  if (!txRows) return;
  txRows.innerHTML = recentTxs.slice(-10).reverse().map(tx => `
    <div style="display:grid; grid-template-columns: 1fr 1fr 0.5fr 0.9fr; gap: 0.5rem; padding: 0.7rem 1.2rem; align-items:center; border-top: 1px solid rgba(229,231,235,0.6); background: transparent;">
      <div style="font-family:monospace; color:#334155;">${shorten(tx.sender)}</div>
      <div style="font-family:monospace; color:#334155;">${shorten(tx.recipient)}</div>
      <div style="text-align:right; font-weight:700; color:#0f766e;">${tx.amount}</div>
      <div style="text-align:right; color:#475569; font-family:monospace;">${new Date(tx.timestamp).toLocaleString()}</div>
    </div>
  `).join('');
}

// Helpers
async function safeExecute(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error: any) {
    console.error(error.message);
    alert(error.message);
  }
}

// Update balances - FIXED: Proper USDC balance handling
// Update balances - FIXED: Proper USDC balance handling
async function updateBalances(account: string) {
  safeExecute(async () => {
    // Set USD to a random demo value between 100 and 1000
    const randomUsd = (Math.random() * (1000 - 100) + 100).toFixed(2);
    if (usdBalanceEl) usdBalanceEl.textContent = `$${randomUsd}`;

    // Update ETH balance from connected wallet
    const ethWei = await web3Service.getEthBalance(account);
    if (ethBalanceEl) ethBalanceEl.textContent = `${ethers.utils.formatEther(ethWei)} ETH`;

    // USDC balance from contract - PROPERLY IMPLEMENTED
    if (usdcBalanceEl) {
      try {
        const usdcBalance = await web3Service.getUsdcBalance(account);
        if (usdcBalanceEl) usdcBalanceEl.textContent = `${usdcBalance} USDC`;

      } catch (error) {
        console.error("USDC Balance Error:", error);
        usdcBalanceEl.textContent = `0.00 USDC`; // Fallback if error
      }
    }
  });
}

// Update button state styles
function setDisconnectedUI() {
  connectBtn.textContent = 'Connect Wallet';
  connectBtn.style.background = '#3b82f6';
  connectBtn.style.color = '#fff';
}

function setConnectedUI(shortAddress: string) {
  connectBtn.textContent = 'Disconnect';
  connectBtn.style.background = '#f87171';
  connectBtn.style.color = '#fff';
  walletStatus.innerHTML = `<span style="display:inline-flex;align-items:center;background:#e0e7ff;color:#2563eb;padding:0.4em 1em;border-radius:1em;font-weight:600;font-size:1.05em;box-shadow:0 1px 4px rgba(59,130,246,0.08);gap:0.5em;">Connected: <span style='font-family:monospace;'>${shortAddress}</span></span>`;
}

// Connect / Disconnect toggle - FIXED: No extra provider/signer creation
connectBtn.addEventListener('click', async () => {
  safeExecute(async () => {
    if (!web3Service.isConnected()) {
      await web3Service.connect(); // triggers MetaMask popup
      const accounts = await web3Service.getAccounts();
      if (accounts.length === 0) throw new Error('No accounts found');
      const address = accounts[0];
      const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
      setConnectedUI(shortAddress);
      await updateBalances(address);

      // Listen to account changes
      window.ethereum.on('accountsChanged', async (accounts: string[]) => {
        if (accounts.length > 0) {
          const addr = accounts[0];
          await updateBalances(addr);
        } else {
          web3Service.disconnect();
          walletStatus.textContent = 'Wallet disconnected';
          setDisconnectedUI();
        }
      });

      // Listen to network changes
      window.ethereum.on('chainChanged', () => window.location.reload());
    } else {
      web3Service.disconnect();
      walletStatus.textContent = 'Wallet disconnected';
      setDisconnectedUI();
      if (ethBalanceEl) ethBalanceEl.textContent = `0 ETH`;
      if (usdcBalanceEl) usdcBalanceEl.textContent = `0.00 USDC`;
    }
  });
});

// Token transfer - safeTransfer only
transferForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  safeExecute(async () => {
    const formData = new FormData(transferForm);
    const toInput = (formData.get('address') as string) || '';
    const to = toInput.trim().replace(/\s+/g, '');
    const amount = formData.get('amount') as string;

    // Basic validation
    let checksumTo: string;
    try {
      checksumTo = ethers.utils.getAddress(to);
    } catch {
      throw new Error('Please enter a valid recipient address');
    }

    const normalized = amount.trim().replace(/,/g, '');
    if (!/^\d*\.?\d+$/.test(normalized)) throw new Error('Please enter a valid decimal amount');

    const memo = "memo"; // optional
    const nullifier = ethers.utils.id(Date.now().toString() + Math.random()); // random
    const tokenDecimals = 6; // USDC 6 decimals
    const parsedAmount = ethers.utils.parseUnits(normalized, tokenDecimals);

    const tx = await web3Service.safeTransfer(checksumTo, parsedAmount, memo, nullifier);
    await tx.wait();

    const accounts = await web3Service.getAccounts();
    if (accounts.length > 0) await updateBalances(accounts[0]);

    alert('Transfer successful!');

    if (accounts.length > 0) {
      recentTxs.push({ sender: accounts[0], recipient: to, amount: `${amount} USDC`, timestamp: Date.now() });
      renderRecentTxs();
    }
  });
});

// Initial UI setup
window.addEventListener('DOMContentLoaded', () => {
  walletStatus.innerHTML = `<span style="display:inline-flex;align-items:center;background:#fee2e2;color:#b91c1c;padding:0.7em 1.2em;border-radius:1.2em;font-weight:600;font-size:1.02em;box-shadow:0 2px 8px rgba(239,68,68,0.10);gap:0.6em;letter-spacing:0.01em;"><svg width='20' height='20' viewBox='0 0 24 24' fill='none'><circle cx='12' cy='12' r='10' fill='#ef4444'/><path d='M12 8v4M12 16h.01' stroke='#fff' stroke-width='2' stroke-linecap='round'/></svg><span style='font-family:monospace;'>Connect your wallet please</span></span>`;
  setDisconnectedUI();

  if (signinCenter) signinCenter.style.display = 'flex';
  if (signInTopBtn) signInTopBtn.style.display = 'none';
  signInBtn.style.display = 'inline-flex';
  signOutBtn.style.display = 'none';
  authSection.style.display = 'none';
  (document.getElementById('transfer-form') as HTMLFormElement).style.display = 'none';
  walletStatus.style.display = 'none';
  connectBtn.style.display = 'none';
  (document.getElementById('recent-transactions') as HTMLDivElement).style.marginTop = '6rem';
  (document.getElementById('recent-transactions') as HTMLDivElement).style.display = 'flex';
  (document.getElementById('recent-transactions') as HTMLDivElement).style.justifyContent = 'center';
});

// Simple auth state
let isSignedIn = false;
function applyAuthUI() {
  if (isSignedIn) {
    if (signinCenter) signinCenter.style.display = 'none';
    signInBtn.style.display = 'none';
    if (signInTopBtn) signInTopBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-flex';
    authSection.style.display = 'flex';
    (document.getElementById('transfer-form') as HTMLFormElement).style.display = 'flex';
    const rt = (document.getElementById('recent-transactions') as HTMLDivElement);
    rt.style.marginTop = '2rem';
    rt.style.display = 'block';
    walletStatus.style.display = 'inline-flex';
    connectBtn.style.display = 'inline-flex';
  } else {
    if (signinCenter) signinCenter.style.display = 'flex';
    signInBtn.style.display = 'inline-flex';
    if (signInTopBtn) signInTopBtn.style.display = 'none';
    signOutBtn.style.display = 'none';
    authSection.style.display = 'none';
    (document.getElementById('transfer-form') as HTMLFormElement).style.display = 'none';
    const rt = (document.getElementById('recent-transactions') as HTMLDivElement);
    rt.style.marginTop = '6rem';
    rt.style.display = 'flex';
    rt.style.justifyContent = 'center';
    walletStatus.style.display = 'none';
    connectBtn.style.display = 'none';
  }
}

// Expose auth setter
// @ts-ignore
(window as any).authSetSignedIn = (value: boolean) => {
  isSignedIn = value;
  applyAuthUI();
};

// Sign-in modal
signInBtn.addEventListener('click', async () => {
  if (authModalEl) authModalEl.style.display = 'flex';
});
if (signInTopBtn) {
  signInTopBtn.addEventListener('click', async () => {
    if (authModalEl) authModalEl.style.display = 'flex';
  });
}

signOutBtn.addEventListener('click', () => {
  isSignedIn = false;
  applyAuthUI();
  if (web3Service.isConnected()) {
    web3Service.disconnect();
    walletStatus.textContent = 'Wallet disconnected';
    setDisconnectedUI();
    if (ethBalanceEl) ethBalanceEl.textContent = `0 ETH`;
    if (usdcBalanceEl) usdcBalanceEl.textContent = `0.00 USDC`;
  }
});