import React from 'react';

interface AuthLoadingOverlayProps {
  text: string;
}

const AuthLoadingOverlay: React.FC<AuthLoadingOverlayProps> = ({ text }) => {
  return (
    <div id="auth-loading" className="auth-loading">
      <div className="auth-loading-content">
        <div className="auth-spinner"></div>
        <div id="auth-loading-text" className="auth-loading-text">
          {text}
        </div>
      </div>
    </div>
  );
};

export default AuthLoadingOverlay;
