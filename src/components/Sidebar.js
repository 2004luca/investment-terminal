// ============================================================
// SIDEBAR.JS — Fixed left navigation panel
// ============================================================

import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV = [
  {
    section: 'Quant Research',
    items: [
      { label: 'Returns & Distribution', path: '/returns-distribution' },
      { label: 'Volatility & Risk',      path: '/volatility-risk' },
      { label: 'Regression & Beta',      path: '/regression-beta' },
      { label: 'Autocorrelation',        path: '/autocorrelation' },
    ],
  },
  {
    section: 'Portfolio',
    items: [
      { label: 'Portfolio Builder',     path: '/portfolio-builder' },
      { label: 'Risk & Return',         path: '/risk-return' },
      { label: 'Efficient Frontier',    path: '/efficient-frontier' },
      { label: 'Factor Models',         path: '/factor-models' },
      { label: 'Stress Testing',        path: '/stress-testing' },
      { label: 'Portfolio Attribution', path: '/portfolio-attribution' },
    ],
  },
];

const Sidebar = () => {
  return (
    <aside className="sidebar">

      <div className="sidebar-logo">
        <h1>Quant Terminal</h1>
        <span>Research & Portfolio</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="sidebar-section-label">
              {group.section}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? 'sidebar-item active' : 'sidebar-item'
                }
              >
                <span className="item-dot" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        Data via Twelvedata
      </div>

    </aside>
  );
};

export default Sidebar;