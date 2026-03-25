// ============================================================
// SIDEBAR.JS — Fixed left navigation panel
// Uses NavLink from react-router-dom to highlight active route
// ============================================================

import React from 'react';
import { NavLink } from 'react-router-dom';

// ── Navigation structure ──
// Each section has a label and an array of page links
const NAV = [
  {
    section: 'Research',
    items: [
      { label: 'Stock Search',       path: '/stock-search' },
      { label: 'Fundamentals',       path: '/fundamentals' },
      { label: 'Technical Analysis', path: '/technical-analysis' },
      { label: 'Quant Analysis',     path: '/quant-analysis' },
      { label: 'Sentiment',          path: '/sentiment' },
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

      {/* ── Logo / Title ── */}
      <div className="sidebar-logo">
        <h1>Investment Terminal</h1>
        <span>Research & Portfolio</span>
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        {NAV.map((group) => (
          <div key={group.section}>

            {/* Section label — RESEARCH / PORTFOLIO */}
            <div className="sidebar-section-label">
              {group.section}
            </div>

            {/* Page links */}
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

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        Data via Yahoo Finance
      </div>

    </aside>
  );
};

export default Sidebar;