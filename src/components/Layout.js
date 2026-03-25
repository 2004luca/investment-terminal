// ============================================================
// LAYOUT.JS — Shell component shared by all pages
// Renders: Sidebar (fixed left) + main content area (right)
// <Outlet /> is where react-router injects the current page
// ============================================================

import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="app-shell">

      {/* Fixed left navigation */}
      <Sidebar />

      {/* Main content — offset by sidebar width via CSS */}
      <main className="main-content">
        <Outlet />
      </main>

    </div>
  );
};

export default Layout;