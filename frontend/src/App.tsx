import React, { useState, useEffect } from 'react';
import StarsBackground from './components/StarsBackground.tsx';
import Header from './components/Header.tsx';
import SignInLanding from './components/SignInLanding.tsx';
import AuthModal from './components/AuthModal.tsx';
import Dashboard from './components/Dashboard.tsx';
import AuthLoadingOverlay from './components/AuthLoadingOverlay.tsx';
import './styles/main.css';
import './styles/dark-theme.css';
import './styles/stars.css';
import './styles/temp-stars.css';

const App: React.FC = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authLoadingText, setAuthLoadingText] = useState('Authenticating...');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check for existing auth on mount
  useEffect(() => {
    try {
      if (localStorage.getItem('fincube_auth')) {
        setIsSignedIn(true);
      }
    } catch (e) {
      // ignore
    }

    // Expose auth setter for backwards compatibility with inline scripts
    (window as any).authSetSignedIn = (value: boolean) => {
      setIsSignedIn(value);
    };
  }, []);

  const handleSignOut = () => {
    setAuthLoadingText('Signing out...');
    setAuthLoading(true);

    setTimeout(() => {
      try {
        localStorage.removeItem('fincube_auth');
        localStorage.removeItem('fincube_address');
        localStorage.setItem('fincube_user_disconnected', '1');
        setIsSignedIn(false);
      } catch (e) {
        console.error('Error during sign-out:', e);
      } finally {
        setAuthLoading(false);
        setAuthLoadingText('Authenticating...');
      }
    }, 600);
  };

  return (
    <div
      id="app"
      className={isSignedIn ? 'dark-theme' : 'signin-landing'}
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <StarsBackground />

      <Header
        isSignedIn={isSignedIn}
        onSignInClick={() => setShowAuthModal(true)}
        onSignOutClick={handleSignOut}
      />

      {!isSignedIn ? (
        <SignInLanding onSignInClick={() => setShowAuthModal(true)} />
      ) : (
        <Dashboard />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={() => {
            setIsSignedIn(true);
            setShowAuthModal(false);
          }}
        />
      )}

      {authLoading && (
        <AuthLoadingOverlay text={authLoadingText} />
      )}
    </div>
  );
};

export default App;
