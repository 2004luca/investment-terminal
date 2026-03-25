// ============================================================
// APP.JS — Root component, router configuration
// Defines all 11 routes and wraps them in the Layout
// ============================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout
import Layout from './components/Layout';

// Research pages
import StockSearch        from './pages/StockSearch';
import Fundamentals       from './pages/Fundamentals';
import TechnicalAnalysis  from './pages/TechnicalAnalysis';
import QuantAnalysis      from './pages/QuantAnalysis';
import Sentiment          from './pages/Sentiment';

// Portfolio pages
import PortfolioBuilder   from './pages/PortfolioBuilder';
import RiskReturn         from './pages/RiskReturn';
import EfficientFrontier  from './pages/EfficientFrontier';
import FactorModels       from './pages/FactorModels';
import StressTesting      from './pages/StressTesting';
import PortfolioAttribution from './pages/PortfolioAttribution';

// Global styles — imported once here, available everywhere
import './styles/global.css';
import './styles/sidebar.css';
import './styles/layout.css';
import './styles/cards.css';
import './styles/charts.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to Stock Search */}
        <Route path="/" element={<Navigate to="/stock-search" replace />} />

        {/* All pages share the Layout wrapper (sidebar + main area) */}
        <Route element={<Layout />}>

          {/* RESEARCH */}
          <Route path="/stock-search"       element={<StockSearch />} />
          <Route path="/fundamentals"       element={<Fundamentals />} />
          <Route path="/technical-analysis" element={<TechnicalAnalysis />} />
          <Route path="/quant-analysis"     element={<QuantAnalysis />} />
          <Route path="/sentiment"          element={<Sentiment />} />

          {/* PORTFOLIO */}
          <Route path="/portfolio-builder"     element={<PortfolioBuilder />} />
          <Route path="/risk-return"           element={<RiskReturn />} />
          <Route path="/efficient-frontier"    element={<EfficientFrontier />} />
          <Route path="/factor-models"         element={<FactorModels />} />
          <Route path="/stress-testing"        element={<StressTesting />} />
          <Route path="/portfolio-attribution" element={<PortfolioAttribution />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;