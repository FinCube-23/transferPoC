import React, { useState } from 'react';
import StarsBackground from './components/StarsBackground.tsx';
import Header from './components/Header.tsx';
import SignInLanding from './components/SignInLanding.tsx';
import AuthModal from './components/AuthModal.tsx';
import Dashboard from './components/Dashboard.tsx';
import AuthLoadingOverlay from './components/AuthLoadingOverlay.tsx';
import { AuthProvider, useAuthContext } from './contexts';
import { WalletProvider } from './contexts';
import './styles/main.css';
import './styles/dark-theme.css';
import './styles/stars.css';
import './styles/temp-stars.css';

const AppContent: React.FC = () => {
  const { isSignedIn, loading: authLoading, loadingText: authLoadingText, signIn, signOut } = useAuthContext();
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

      {authLoading && (
        <AuthLoadingOverlay text={authLoadingText} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <WalletProvider>
        <AppContent />
      </WalletProvider>
    </AuthProvider>
  );
};

export default App;
