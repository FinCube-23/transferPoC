import React, { useState } from 'react';
import StarsBackground from './components/StarsBackground.tsx';
import Header from './components/Header.tsx';
import SignInLanding from './components/SignInLanding.tsx';
import AuthModal from './components/AuthModal.tsx';
import Dashboard from './components/Dashboard.tsx';
import AuthLoadingOverlay from './components/AuthLoadingOverlay.tsx';
import { useAuthStore } from './stores/authStore';
import { useWalletStore } from './stores/walletStore';
import './styles/main.css';
import './styles/dark-theme.css';
import './styles/stars.css';
import './styles/temp-stars.css';

const AppContent: React.FC = () => {
  // Use selective subscriptions for state
  const isSignedIn = useAuthStore((state) => state.isSignedIn);
  const loading = useAuthStore((state) => state.loading);
  const loadingText = useAuthStore((state) => state.loadingText);
  
  // Use selective subscriptions for actions
  const signIn = useAuthStore((state) => state.signIn);
  const signOut = useAuthStore((state) => state.signOut);
  
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div
      id="app"
      className={isSignedIn ? 'dark-theme' : 'signin-landing'}
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        minHeight: '100vh',
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
        onSignOutClick={signOut}
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
            signIn();
            setShowAuthModal(false);
          }}
        />
      )}

      {loading && (
        <AuthLoadingOverlay text={loadingText} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  // Initialize stores on app mount
  React.useEffect(() => {
    // Initialize auth store (restore sign-in state from localStorage)
    useAuthStore.getState().initialize();

    // Initialize wallet store (restore connection from localStorage)
    useWalletStore.getState().initialize();

    // Setup wallet event listeners for MetaMask events
    const cleanup = useWalletStore.getState().setupEventListeners();

    // Return cleanup function to remove event listeners on unmount
    return cleanup;
  }, []);
  
  return <AppContent />;
};

export default App;
