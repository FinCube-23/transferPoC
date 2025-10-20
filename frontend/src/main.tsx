import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { Buffer } from 'buffer';

// Polyfill for Buffer (required for ethers.js)
window.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
