import React, { useState } from 'react';

interface AuthModalProps {
  onClose: () => void;
  onAuthSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // This will use the inline script logic from index.html
    // For now, just simulate success
    try {
      localStorage.setItem('fincube_auth', 'true');
      onAuthSuccess();
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // This will use the inline script logic from index.html
    alert('Registration successful. Please login.');
    setActiveTab('login');
  };

  return (
    <div
      id="auth-modal"
      onClick={handleBackdropClick}
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: '0.9rem',
          boxShadow: '0 24px 60px rgba(2, 6, 23, 0.35)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Tabs */}
        <div
          style={{
            padding: '0.8rem 1rem 0.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '0.4rem',
          }}
        >
          <button
            onClick={() => setActiveTab('login')}
            style={{
              flex: 1,
              padding: '0.6rem',
              border: 'none',
              background: activeTab === 'login' ? '#ecfdf5' : 'transparent',
              color: activeTab === 'login' ? '#10b981' : '#334155',
              borderRadius: '0.6rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1,
              padding: '0.6rem',
              border: 'none',
              background: activeTab === 'register' ? '#ecfdf5' : 'transparent',
              color: activeTab === 'register' ? '#10b981' : '#334155',
              borderRadius: '0.6rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Register
          </button>
        </div>

        <div style={{ padding: '0.8rem 1rem' }}>
          {/* Login Form */}
          {activeTab === 'login' && (
            <form
              onSubmit={handleLogin}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label
                  htmlFor="login-email"
                  style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.8rem 0.9rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '0.7rem',
                    fontSize: '1rem',
                    background: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label
                  htmlFor="login-password"
                  style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Your password"
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '0.8rem 0.9rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '0.7rem',
                    fontSize: '1rem',
                    background: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  marginTop: '0.2rem',
                  padding: '0.8rem 1rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.7rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 10px 22px rgba(16, 185, 129, 0.35)',
                }}
              >
                Sign In
              </button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form
              onSubmit={handleRegister}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                    First name
                  </label>
                  <input
                    type="text"
                    placeholder="John"
                    required
                    style={{
                      width: '100%',
                      padding: '0.8rem 0.9rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '0.7rem',
                      fontSize: '1rem',
                      background: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                    Last name
                  </label>
                  <input
                    type="text"
                    placeholder="Doe"
                    required
                    style={{
                      width: '100%',
                      padding: '0.9rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '0.7rem',
                      fontSize: '1rem',
                      background: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.8rem 0.9rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '0.7rem',
                    fontSize: '1rem',
                    background: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Create a password"
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '0.8rem 0.9rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '0.7rem',
                    fontSize: '1rem',
                    background: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  marginTop: '0.2rem',
                  padding: '0.8rem 1rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.7rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 10px 22px rgba(16, 185, 129, 0.35)',
                }}
              >
                Sign Up
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
