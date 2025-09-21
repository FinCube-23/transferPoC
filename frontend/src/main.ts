import './styles/main.css';
import './styles/dark-theme.css';
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
    <div class="transaction-row">
      <div class="tx-address">${shorten(tx.sender)}</div>
      <div class="tx-address">${shorten(tx.recipient)}</div>
      <div class="tx-amount">${tx.amount}</div>
      <div class="tx-date">${new Date(tx.timestamp).toLocaleString()}</div>
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

    // Update ETH balance from connected wallet with 5 decimal places
    const ethWei = await web3Service.getEthBalance(account);
    const ethFormatted = parseFloat(ethers.utils.formatEther(ethWei)).toFixed(5);
    if (ethBalanceEl) ethBalanceEl.textContent = `${ethFormatted} ETH`;

    // USDC balance from contract with 4 decimal places
    if (usdcBalanceEl) {
      try {
        const usdcBalance = await web3Service.getUsdcBalance(account);
        const usdcFormatted = parseFloat(usdcBalance).toFixed(4);
        if (usdcBalanceEl) usdcBalanceEl.textContent = `${usdcFormatted} USDC`;

      } catch (error) {
        console.error("USDC Balance Error:", error);
        usdcBalanceEl.textContent = `0.0000 USDC`; // Fallback if error
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
  walletStatus.innerHTML = `<div class="status-light connected-light"></div>Connected: ${shortAddress}`;
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
          walletStatus.innerHTML = `<div class="status-light disconnected-light"></div>Wallet disconnected`;
          setDisconnectedUI();
        }
      });

      // Listen to network changes
      window.ethereum.on('chainChanged', () => window.location.reload());
    } else {
      web3Service.disconnect();
      walletStatus.innerHTML = `<div class="status-light disconnected-light"></div>Wallet disconnected`;
      setDisconnectedUI();
      if (ethBalanceEl) ethBalanceEl.textContent = `0.00000 ETH`;
      if (usdcBalanceEl) usdcBalanceEl.textContent = `0.0000 USDC`;
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
  walletStatus.innerHTML = `<div class="status-light disconnected-light"></div>Connect your wallet please`;
  setDisconnectedUI();

  if (signinCenter) signinCenter.style.display = 'flex';
  if (signInTopBtn) signInTopBtn.style.display = 'none';
  signInBtn.style.display = 'inline-flex';
  signOutBtn.style.display = 'none';
  authSection.style.display = 'none';
  (document.getElementById('transfer-form') as HTMLFormElement).style.display = 'none';
  walletStatus.style.display = 'none';
  connectBtn.style.display = 'none';
  // Keep recent transactions hidden on sign-in page
  (document.getElementById('recent-transactions') as HTMLDivElement).style.display = 'none';

  // Setup sign-in button click handler
  signInBtn.addEventListener('click', async (e) => {
    console.log('Sign in button clicked');
    e.preventDefault();

    // Directly show the auth modal without loading
    if (authModalEl) authModalEl.style.display = 'flex';
  });
});

  try {
    if (localStorage.getItem('fincube_auth')) {
      // Use the exposed setter to ensure UI updates correctly
      (window as any).authSetSignedIn && (window as any).authSetSignedIn(true);
    }
  } catch (e) { /* ignore */ }
// Simple auth state
let isSignedIn = false;
function applyAuthUI() {
  const appContainer = document.getElementById('app');
  const headerElement = document.querySelector('.app-header') as HTMLElement;

  if (isSignedIn) {
    // Apply dark theme with emerald-cyan gradient to inside page
    if (appContainer) {
      appContainer.classList.add('dark-theme');
      appContainer.classList.remove('signin-landing');
    }

    // Show header when signed in
    if (headerElement) headerElement.classList.remove('signin-hide');

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
    // Apply sign-in landing page styling
    if (appContainer) {
      appContainer.classList.remove('dark-theme');
      appContainer.classList.add('signin-landing');
    }

    // Hide header when on sign-in page
    if (headerElement) headerElement.classList.add('signin-hide');

    if (signinCenter) signinCenter.style.display = 'flex';
    signInBtn.style.display = 'inline-flex';
    if (signInTopBtn) signInTopBtn.style.display = 'none';
    signOutBtn.style.display = 'none';
    authSection.style.display = 'none';
    (document.getElementById('transfer-form') as HTMLFormElement).style.display = 'none';
    const rt = (document.getElementById('recent-transactions') as HTMLDivElement);
    rt.style.display = 'none'; // Hide recent transactions on sign-in page
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

if (signInTopBtn) {
  signInTopBtn.addEventListener('click', async () => {
    if (authModalEl) authModalEl.style.display = 'flex';
  });
}

signOutBtn.addEventListener('click', () => {
  const authLoadingEl = document.getElementById('auth-loading') as HTMLDivElement | null;
  const authLoadingText = document.getElementById('auth-loading-text') as HTMLDivElement | null;

  try {
    if (authLoadingText) authLoadingText.textContent = 'Signing out...';
    if (authLoadingEl) authLoadingEl.style.display = 'flex';
  } catch (e) { /* ignore */ }

  // Wait a short moment so the loader is visible first, then perform sign-out actions
  setTimeout(() => {
    try {
      // Disconnect wallet if connected
      if (web3Service.isConnected()) {
        web3Service.disconnect();
        walletStatus.innerHTML = `<div class="status-light disconnected-light"></div>Wallet disconnected`;
        setDisconnectedUI();
        if (ethBalanceEl) ethBalanceEl.textContent = `0.00000 ETH`;
        if (usdcBalanceEl) usdcBalanceEl.textContent = `0.0000 USDC`;
      }

      // Clear frontend persistence and switch UI to signed-out
      try { localStorage.removeItem('fincube_auth'); } catch (e) { /* ignore */ }
      isSignedIn = false;
      applyAuthUI();

    } catch (err) {
      console.error('Error during sign-out:', err);
    } finally {
      // Hide loader and restore loading text
      try {
        if (authLoadingEl) authLoadingEl.style.display = 'none';
        if (authLoadingText) authLoadingText.textContent = 'Authenticating...';
      } catch (e) {}
    }
  }, 600);
});