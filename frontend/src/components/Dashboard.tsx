import React, { useEffect, useState } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useTransactions } from '../hooks/useTransactions';
import { web3Service } from '../services/web3Service';
import { ethers } from 'ethers';
import type { ParsedTransfer } from '../services/graphService';

const Dashboard: React.FC = () => {
  // Selective subscriptions to wallet store
  const isConnected = useWalletStore((state) => state.isConnected);
  const currentAccount = useWalletStore((state) => state.currentAccount);
  const balances = useWalletStore((state) => state.balances);
  const updateBalances = useWalletStore((state) => state.updateBalances);
  const {
    transactions,
    currentPage,
    totalPages,
    loadTransactions,
    addTransaction,
    nextPage,
    prevPage,
    clearTransactions,
  } = useTransactions();

  const [transferForm, setTransferForm] = useState({
    address: '',
    amount: '',
    purpose: '',
  });

  // Load transactions when wallet connects
  useEffect(() => {
    if (isConnected && currentAccount) {
      loadTransactions(currentAccount);
      updateBalances(); 
      clearTransactions();
    }
  }, [isConnected, currentAccount, loadTransactions, clearTransactions]);

  return (
    <>
      {/* Token Balances (Auth Only) */}
      <div
        id="auth-section"
        style={{
          display: 'flex',
          marginTop: '0.3rem',
          marginLeft: 'auto',
          marginRight: 'auto',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '900px',
          gap: '0.25rem',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.06), rgba(16, 185, 129, 0.04))',
            border: '1px solid rgba(6, 182, 212, 0.08)',
            boxShadow: '0 10px 30px rgba(6, 182, 212, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="wlgrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <rect x="2" y="5" width="16" height="12" rx="2.5" fill="url(#wlgrad)" opacity="0.1" />
            <rect x="2" y="5" width="16" height="12" rx="2.5" stroke="url(#wlgrad)" strokeWidth="1.8" />
            <path d="M2 7.5h16" stroke="url(#wlgrad)" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="4" y="9" width="8" height="5" rx="0.8" fill="url(#wlgrad)" opacity="0.3" />
            <rect x="5" y="10" width="6" height="3" rx="0.5" fill="url(#wlgrad)" opacity="0.5" />
            <rect x="18" y="8" width="4" height="6" rx="1" fill="url(#wlgrad)" opacity="0.2" />
            <rect x="18" y="8" width="4" height="6" rx="1" stroke="url(#wlgrad)" strokeWidth="1.6" />
            <circle cx="20" cy="11" r="0.8" fill="#10b981" />
          </svg>
          <span
            style={{
              fontWeight: 900,
              fontSize: '1.35em',
              letterSpacing: '0.03em',
              background: 'linear-gradient(90deg, #0f172a 0%, #10b981 50%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Wallets
          </span>
        </div>
        <div
          className="balance-grid"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.3rem',
            flexWrap: 'wrap',
            width: '100%',
            marginTop: '0.2rem',
          }}
        >
          {/* USD */}
          <div
            className="balance-card-item"
            style={{
              flex: '1 1 180px',
              maxWidth: '220px',
              background: '#f8fafc',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '1rem',
              textAlign: 'center',
              padding: '0.7rem',
              boxShadow: '0 4px 14px rgba(6, 182, 212, 0.15)',
              transition: 'transform 0.2s',
            }}
          >
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.3rem',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 0 }} aria-label="USD">
                <circle cx="12" cy="12" r="12" fill="#10b981" />
                <path
                  d="M13.75 7.75c0-.966-.784-1.75-1.75-1.75s-1.75.784-1.75 1.75c0 .966.784 1.75 1.75 1.75h1c1.243 0 2.25 1.007 2.25 2.25s-1.007 2.25-2.25 2.25h-2.5"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M12 5v14" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div
              style={{
                fontWeight: 700,
                color: '#111827',
                fontSize: '1.05em',
                marginBottom: '0.3rem',
              }}
            >
              USD Balance
            </div>
            <div id="usd-balance">{balances.usd}</div>
          </div>
          {/* ETH */}
          <div
            className="balance-card-item"
            style={{
              flex: '1 1 180px',
              maxWidth: '220px',
              background: '#f8fafc',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '1rem',
              textAlign: 'center',
              padding: '0.7rem',
              boxShadow: '0 4px 14px rgba(6, 182, 212, 0.15)',
              transition: 'transform 0.2s',
            }}
          >
            <div
              style={{
                background: 'rgba(98, 126, 234, 0.1)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.3rem',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-label="ETH">
                <circle cx="12" cy="12" r="12" fill="#627eea" />
                <path d="M12 3l-6 10 6 3.5 6-3.5z" fill="#fff" opacity="0.6" />
                <path d="M12 3l6 10-6 3.5z" fill="#fff" />
                <path d="M12 18l-6-3.5L12 21l6-6.5z" fill="#fff" opacity="0.6" />
                <path d="M12 18l6-3.5L12 21z" fill="#fff" />
              </svg>
            </div>
            <div
              style={{
                fontWeight: 700,
                color: '#111827',
                fontSize: '1.05em',
                marginBottom: '0.3rem',
              }}
            >
              ETH Balance
            </div>
            <div id="eth-balance">{balances.eth} ETH</div>
          </div>
          {/* USDC */}
          <div
            className="balance-card-item"
            style={{
              flex: '1 1 180px',
              maxWidth: '220px',
              background: '#f8fafc',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '1rem',
              textAlign: 'center',
              padding: '0.7rem',
              boxShadow: '0 4px 14px rgba(6, 182, 212, 0.15)',
              transition: 'transform 0.2s',
            }}
          >
            <div
              style={{
                background: 'rgba(39, 117, 202, 0.1)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.3rem',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-label="USDC">
                <circle cx="12" cy="12" r="12" fill="#2775ca" />
                <circle cx="12" cy="12" r="8" fill="none" stroke="#fff" strokeWidth="1.5" />
                <path
                  d="M10 9.5c0-.828.672-1.5 1.5-1.5h1c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5h-1.5v2h1.5c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5h-1c-.828 0-1.5-.672-1.5-1.5"
                  stroke="#fff"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <path d="M12 7v1.5M12 15.5V17" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div
              style={{
                fontWeight: 700,
                color: '#111827',
                fontSize: '1.05em',
                marginBottom: '0.3rem',
              }}
            >
              USDC Balance
            </div>
            <div id="usdc-balance">{balances.usdc} USDC</div>
          </div>
        </div>
      </div>

      {/* Transfer Form */}
      <form
        id="transfer-form"
        onSubmit={async (e) => {
          e.preventDefault();
          
          try {
            const toInput = transferForm.address.trim().replace(/\s+/g, '');
            const amount = transferForm.amount;
            const purpose = transferForm.purpose;

            // Basic validation
            let checksumTo: string;
            try {
              checksumTo = ethers.utils.getAddress(toInput);
            } catch {
              throw new Error('Please enter a valid recipient address');
            }

            const normalized = amount.trim().replace(/,/g, '');
            if (!/^\d*\.?\d+$/.test(normalized)) {
              throw new Error('Please enter a valid decimal amount');
            }

            if (!purpose.trim()) {
              throw new Error('Please enter a purpose for this transfer');
            }

            // Create memo in memo.json format
            const memoData = {
              TransactionInformation: {
                MessageID: `tx_${Date.now()}`,
                CreationDateTime: new Date().toISOString(),
                TransactionID: ethers.utils.id(
                  `${currentAccount}_${checksumTo}_${normalized}_${Date.now()}`
                ),
                InterOrganizationSettlementAmount: {
                  Currency: 'USDC',
                  Amount: normalized,
                },
                Debtor: {
                  Name: 'FinCube User',
                },
                DebtorAccount: {
                  wallet_address: currentAccount,
                },
                DebtorOrganization: {
                  ID: 'FINCUBE',
                  Name: 'FinCube Network',
                },
                CreditorOrganization: {
                  ID: 'FINCUBE',
                  Name: 'FinCube Network',
                },
                Creditor: {
                  Name: 'Recipient',
                },
                CreditorAccount: {
                  wallet_address: checksumTo,
                },
                RemittanceInformation: {
                  Unstructured: purpose.trim(),
                  Structured: {
                    Reference: '0x8a263DcEfee44B9Abe968C1B18e370f6A0A5F878',
                  },
                },
                ChargesInformation: {
                  Bearer: 'DEBT',
                },
                Purpose: purpose.trim(),
                RegulatoryReporting: {
                  Code: 'TRANSFER',
                },
              },
            };

            const memo = JSON.stringify(memoData);

            // Calculate nullifier as hash of to, amount, and memo
            const nullifierInput = `${checksumTo}_${normalized}_${memo}`;
            const nullifier = ethers.utils.keccak256(
              ethers.utils.toUtf8Bytes(nullifierInput)
            );

            const tokenDecimals = 6; // USDC 6 decimals
            const parsedAmount = ethers.utils.parseUnits(normalized, tokenDecimals);

            const tx = await web3Service.safeTransfer(
              checksumTo,
              parsedAmount,
              memo,
              nullifier
            );
            await tx.wait();

            await updateBalances();

            alert('Transfer successful!');

            // Add transaction to list
            const normalizeHash = (candidate?: string | null): string | undefined => {
              if (!candidate) return undefined;
              const s = String(candidate).trim();
              const m = s.match(/0x[a-fA-F0-9]{64}/);
              if (m) return m[0];
              if (s.includes('-')) {
                const left = s.split('-')[0];
                if (/^0x[a-fA-F0-9]{64}$/.test(left)) return left;
                const mm = left.match(/0x[a-fA-F0-9]{64}/);
                if (mm) return mm[0];
              }
              if (s.startsWith('0x') && s.length >= 66) return s.slice(0, 66);
              return undefined;
            };

            const recordedHash = normalizeHash(tx && (tx as any).hash) || (tx && (tx as any).hash);
            
            const newTx: ParsedTransfer = {
              sender: currentAccount || '',
              recipient: toInput,
              amount: `${amount} USDC`,
              purpose: purpose.trim(),
              nullifier: nullifier,
              timestamp: Date.now(),
              txHash: recordedHash,
            };

            addTransaction(newTx);

            // Clear form
            setTransferForm({
              address: '',
              amount: '',
              purpose: '',
            });
          } catch (error: any) {
            console.error(error.message);
            alert(error.message);
          }
        }}
        style={{
          display: 'flex',
          marginTop: '0.75rem',
          marginLeft: 'auto',
          marginRight: 'auto',
          flexDirection: 'column',
          gap: '0.8rem',
          width: '100%',
          maxWidth: '420px',
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            name="address"
            value={transferForm.address}
            onChange={(e) => setTransferForm({ ...transferForm, address: e.target.value })}
            placeholder="Recipient Address"
            required
            style={{
              width: '100%',
              padding: '1rem 1.2rem',
              border: '2px solid #e2e8f0',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 500,
              outline: 'none',
              background: 'rgba(255, 255, 255, 0.9)',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '1rem',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="10" r="3" stroke="#94a3b8" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            name="amount"
            value={transferForm.amount}
            onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
            placeholder="Amount"
            inputMode="decimal"
            required
            style={{
              width: '100%',
              padding: '1rem 1.2rem',
              border: '2px solid #e2e8f0',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 500,
              outline: 'none',
              background: 'rgba(255, 255, 255, 0.9)',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '1rem',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="ETH">
              <path d="M12 2l6 9-6 3-6-3 6-9z" fill="#94a3b8" opacity="0.95" />
              <path d="M12 14l6-3-6 11-6-11 6 3z" fill="#94a3b8" opacity="0.7" />
            </svg>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            name="purpose"
            value={transferForm.purpose}
            onChange={(e) => setTransferForm({ ...transferForm, purpose: e.target.value })}
            placeholder="Purpose (e.g., Salary, Invoice, Refund)"
            required
            style={{
              width: '100%',
              padding: '1rem 1.2rem',
              border: '2px solid #e2e8f0',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 500,
              outline: 'none',
              background: 'rgba(255, 255, 255, 0.9)',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '1rem',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16M7 12h10M8 17h8"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '1rem 1.5rem',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.75rem',
            fontWeight: 700,
            fontSize: '1.1rem',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            style={{ position: 'relative', zIndex: 1 }}
          >
            <path
              d="M3 12h18m-9-9l9 9-9 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ position: 'relative', zIndex: 1 }}>Transfer</span>
        </button>
      </form>

      {/* Recent Transactions */}
      <section
        id="recent-transactions"
        style={{
          maxWidth: '1200px',
          width: 'calc(100% - 2rem)',
          padding: '1rem 1.5rem',
          boxSizing: 'border-box',
          margin: '2rem auto 0',
        }}
      >
        <div className="transactions-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="transactions-title" style={{ margin: 0 }}>Recent Transactions</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => {
                const FINCUBE_ADDRESS = '0x8a263DcEfee44B9Abe968C1B18e370f6A0A5F878';
                window.open(`https://sepolia.etherscan.io/address/${FINCUBE_ADDRESS}`, '_blank', 'noopener');
              }}
              title="View latest transaction on Etherscan (Sepolia)"
              style={{
                background: 'transparent',
                color: '#21325b',
                border: 'none',
                padding: '2px',
                marginRight: '4px',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 293.775 293.667" xmlns="http://www.w3.org/2000/svg">
                <g fill="#21325b">
                  <path d="M146.8 0C65.777 0 0 65.777 0 146.834 0 227.86 65.777 293.667 146.8 293.667c81.056 0 146.833-65.808 146.833-146.833C293.633 65.777 227.856 0 146.8 0zm-3.177 238.832c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm58.63-82.585c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm-117.26 0c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124z"/>
                </g>
              </svg>
            </button>
            <div className="transactions-subtitle" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Latest 10
            </div>
          </div>
        </div>
        <div className="transactions-table">
          <div className="transactions-table-header">
            <div>Sender</div>
            <div>Recipient</div>
            <div style={{ textAlign: 'right' }}>Amount</div>
            <div>Memo</div>
            <div style={{ textAlign: 'right' }}>Date</div>
            <div style={{ textAlign: 'right' }}></div>
          </div>
          <div id="tx-rows" className="transactions-rows">
            {renderTransactions()}
          </div>
        </div>
        {renderPagination()}
      </section>
    </>
  );

  function renderTransactions() {
    const ITEMS_PER_PAGE = 10;
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    const start = currentPage * ITEMS_PER_PAGE;
    const page = sorted.slice(start, start + ITEMS_PER_PAGE);

    const shorten = (addr: string): string => {
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const etherscanIcon = '<svg width="14" height="14" viewBox="0 0 293.775 293.667" xmlns="http://www.w3.org/2000/svg"><g fill="#21325b"><path d="M146.8 0C65.777 0 0 65.777 0 146.834 0 227.86 65.777 293.667 146.8 293.667c81.056 0 146.833-65.808 146.833-146.833C293.633 65.777 227.856 0 146.8 0zm-3.177 238.832c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm58.63-82.585c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124zm-117.26 0c-22.155 0-40.124-17.969-40.124-40.124s17.969-40.124 40.124-40.124 40.124 17.969 40.124 40.124-17.969 40.124-40.124 40.124z"/></g></svg>';

    return page.map((tx, index) => {
      const displayedPurpose = (tx.purpose && tx.purpose.trim()) ? tx.purpose.trim() : 'Refund';
      const FINCUBE_ADDRESS = '0x8a263DcEfee44B9Abe968C1B18e370f6A0A5F878';
      
      const rawCandidate = tx.txHash || '';
      const match = String(rawCandidate).match(/0x[a-fA-F0-9]{64}/);
      const txHashForUrl = match ? match[0] : undefined;
      const txUrl = txHashForUrl
        ? `https://sepolia.etherscan.io/tx/${txHashForUrl}`
        : `https://sepolia.etherscan.io/address/${FINCUBE_ADDRESS}#events`;

      return (
        <div key={`${tx.txHash || ''}-${index}`} className="transaction-row">
          <div className="tx-address">{shorten(tx.sender)}</div>
          <div className="tx-address">{shorten(tx.recipient)}</div>
          <div className="tx-amount">{tx.amount}</div>
          <div className="tx-memo">
            <div style={{ fontSize: '0.75em', lineHeight: 1.2, color: '#6b7280' }}>
              <div><span className="label-green" style={{ color: '#10b981' }}>Reference</span>: {shorten(FINCUBE_ADDRESS)}</div>
              <div><span className="label-green" style={{ color: '#10b981' }}>Purpose</span>: {displayedPurpose}</div>
              <div><span className="label-green" style={{ color: '#10b981' }}>Description</span>: Transferred</div>
            </div>
          </div>
          <div className="tx-date">{new Date(tx.timestamp).toLocaleString()}</div>
          <div className="tx-etherscan">
            <a 
              className="etherscan-link" 
              href={txUrl} 
              target="_blank" 
              rel="noopener" 
              title="View on Etherscan"
              dangerouslySetInnerHTML={{ __html: etherscanIcon }}
            />
          </div>
        </div>
      );
    });
  }

  function renderPagination() {
    const hasPrevious = currentPage > 0;
    const hasNext = currentPage < totalPages - 1;

    if (totalPages <= 1) return null;

    return (
      <div
        id="pagination-controls"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '4rem',
          padding: '1rem 0',
          marginTop: '1rem',
        }}
      >
        <button
          onClick={prevPage}
          disabled={!hasPrevious}
          className="pagination-arrow"
          aria-label="Previous page"
          style={{
            background: 'transparent',
            color: hasPrevious ? '#0f172a' : '#9aa3b2',
            border: 'none',
            padding: '4px 8px',
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: hasPrevious ? 'pointer' : 'not-allowed',
            transition: 'color 0.12s ease, transform 0.12s ease',
            borderRadius: '4px',
            boxShadow: 'none',
          }}
          onMouseEnter={(e) => hasPrevious && (e.currentTarget.style.transform = 'translateY(-1px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          ←
        </button>
        <span
          style={{
            color: '#64748b',
            fontWeight: 500,
            fontSize: '0.9rem',
            margin: '0 0.5rem',
          }}
        >
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={!hasNext}
          className="pagination-arrow"
          aria-label="Next page"
          style={{
            background: 'transparent',
            color: hasNext ? '#0f172a' : '#9aa3b2',
            border: 'none',
            padding: '4px 8px',
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: hasNext ? 'pointer' : 'not-allowed',
            transition: 'color 0.12s ease, transform 0.12s ease',
            borderRadius: '4px',
            boxShadow: 'none',
          }}
          onMouseEnter={(e) => hasNext && (e.currentTarget.style.transform = 'translateY(-1px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          →
        </button>
      </div>
    );
  }
};

export default Dashboard;
