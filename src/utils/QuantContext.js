// ============================================================
// QUANT CONTEXT
// Shared state across all quant research pages
// Stores the last searched ticker and its historical data
// ============================================================

import React, { createContext, useContext, useState } from 'react';

const QuantContext = createContext(null);

export const QuantProvider = ({ children }) => {
  const [quantTicker, setQuantTicker]   = useState('');
  const [quantHistory, setQuantHistory] = useState([]);
  const [quantReturns, setQuantReturns] = useState([]);
  const [quantDates, setQuantDates]     = useState([]);
  const [quantSpyRets, setQuantSpyRets] = useState([]);

  return (
    <QuantContext.Provider value={{
      quantTicker,  setQuantTicker,
      quantHistory, setQuantHistory,
      quantReturns, setQuantReturns,
      quantDates,   setQuantDates,
      quantSpyRets, setQuantSpyRets,
    }}>
      {children}
    </QuantContext.Provider>
  );
};

export const useQuant = () => {
  const ctx = useContext(QuantContext);
  if (!ctx) throw new Error('useQuant must be used within QuantProvider');
  return ctx;
};