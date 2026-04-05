// ============================================================
// INDEX.JS — Entry point, mounts the React app into the DOM
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PortfolioProvider } from './utils/PortfolioContext';
import { QuantProvider } from './utils/QuantContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PortfolioProvider>
      <QuantProvider>
        <App />
      </QuantProvider>
    </PortfolioProvider>
  </React.StrictMode>
);