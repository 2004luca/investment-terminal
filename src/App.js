// ============================================================
// APP.JS — Router configuration
// Quant Research + Portfolio sections
// ============================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout';

// Quant Research
import ReturnsDistribution from './pages/ReturnsDistribution';
import VolatilityRisk      from './pages/VolatilityRisk';
import RegressionBeta      from './pages/RegressionBeta';
import Autocorrelation     from './pages/Autocorrelation';

// Portfolio
import PortfolioBuilder    from './pages/PortfolioBuilder';
import RiskReturn          from './pages/RiskReturn';
import EfficientFrontier   from './pages/EfficientFrontier';
import FactorModels        from './pages/FactorModels';
import StressTesting       from './pages/StressTesting';
import PortfolioAttribution from './pages/PortfolioAttribution';

import './styles/global.css';
import './styles/sidebar.css';
import './styles/layout.css';
import './styles/cards.css';
import './styles/charts.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/returns-distribution" replace />} />
        <Route element={<Layout />}>

          {/* Quant Research */}
          <Route path="/returns-distribution" element={<ReturnsDistribution />} />
          <Route path="/volatility-risk"      element={<VolatilityRisk />} />
          <Route path="/regression-beta"      element={<RegressionBeta />} />
          <Route path="/autocorrelation"      element={<Autocorrelation />} />

          {/* Portfolio */}
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