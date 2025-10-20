import React, { useEffect } from 'react';

const Dashboard: React.FC = () => {
  useEffect(() => {
    // The existing main.ts logic will handle DOM manipulations
    // This is a transitional component that preserves the existing structure
  }, []);

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
        <div className="balance-grid">
          <div className="balance-card">
            <div className="balance-label">USD Balance</div>
            <div id="usd-balance" className="balance-value">
              $0.00
            </div>
          </div>
          <div className="balance-card">
            <div className="balance-label">ETH Balance</div>
            <div id="eth-balance" className="balance-value">
              0.00000 ETH
            </div>
          </div>
          <div className="balance-card">
            <div className="balance-label">USDC Balance</div>
            <div id="usdc-balance" className="balance-value">
              0.0000 USDC
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Form */}
      <form
        id="transfer-form"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          width: '100%',
          maxWidth: '900px',
          margin: '0.5rem auto',
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '1rem',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <h3
          style={{
            color: '#fff',
            margin: '0 0 0.5rem 0',
            fontSize: '1.2rem',
            fontWeight: 600,
          }}
        >
          Transfer USDC
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
            Recipient Address
          </label>
          <input
            name="address"
            placeholder="0x..."
            required
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              fontSize: '1rem',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Amount</label>
          <input
            name="amount"
            type="number"
            step="0.000001"
            placeholder="0.00"
            required
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              fontSize: '1rem',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>Purpose</label>
          <input
            name="purpose"
            placeholder="Payment purpose"
            required
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              fontSize: '1rem',
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.6rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Send Transfer
        </button>
      </form>

      {/* Recent Transactions */}
      <section
        id="recent-transactions"
        style={{
          width: '100%',
          maxWidth: '900px',
          margin: '2rem auto 2rem',
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '1rem',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="transactions-header">
          <h3 style={{ color: '#fff', margin: 0 }}>Recent Transactions</h3>
          <div className="transactions-subtitle" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Latest 10
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
            {/* Rows injected here */}
          </div>
        </div>
      </section>
    </>
  );
};

export default Dashboard;
