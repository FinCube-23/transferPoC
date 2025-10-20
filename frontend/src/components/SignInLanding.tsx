import React from 'react';

interface SignInLandingProps {
  onSignInClick: () => void;
}

const SignInLanding: React.FC<SignInLandingProps> = ({ onSignInClick }) => {
  return (
    <div id="signin-center" className="signin-landing">
      <div className="signin-content-seamless">
        {/* Logo and Branding */}
        <div className="signin-logo">
          <div className="app-logo-icon-large">
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </div>

          {/* FINCUBE with three feature icons */}
          <div className="fincube-branding">
            <h1 className="signin-title">FINCUBE</h1>
            <div className="feature-icons">
              <div className="feature-item">
                <div className="feature-icon seamless-icon" title="Seamless">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div className="feature-text">
                  <span className="feature-title seamless-text">Seamless</span>
                  <span className="feature-description">Effortless transactions</span>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon lightning-icon" title="Lightning">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="22,12 18,12 15,21 9,9 6,12 2,12" />
                  </svg>
                </div>
                <div className="feature-text">
                  <span className="feature-title lightning-text">Lightning</span>
                  <span className="feature-description">Ultra-fast speed</span>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon transfer-icon" title="Transfer">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M7 17L17 7M17 7H7M17 7V17" />
                  </svg>
                </div>
                <div className="feature-text">
                  <span className="feature-title transfer-text">Transfer</span>
                  <span className="feature-description">Secure payments</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sign In Button */}
        <button id="sign-in" className="signin-button-seamless" onClick={onSignInClick}>
          Sign In
        </button>
      </div>
    </div>
  );
};

export default SignInLanding;
