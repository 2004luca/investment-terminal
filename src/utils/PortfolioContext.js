// ============================================================
// PORTFOLIO CONTEXT
// Global state shared across all portfolio pages
// Stores the portfolio data built in PortfolioBuilder
// ============================================================

import React, { createContext, useContext, useState } from 'react';

const PortfolioContext = createContext(null);

export const PortfolioProvider = ({ children }) => {
  const [portfolioData, setPortfolioData] = useState(null);
  const [holdings, setHoldings]           = useState([]);

  return (
    <PortfolioContext.Provider value={{
      portfolioData,
      setPortfolioData,
      holdings,
      setHoldings,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
};