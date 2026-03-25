// ============================================================
// FORMATTERS — Pure functions for displaying numbers cleanly
// Used across every page: prices, percentages, large numbers
// ============================================================

// ── Currency — e.g. 142.56 → "$142.56" ──
export const formatPrice = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// ── Percentage — e.g. 0.1523 → "15.23%" ──
export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${(value * 100).toFixed(decimals)}%`;
};

// ── Percentage already in % form — e.g. 15.23 → "15.23%" ──
export const formatPercentDirect = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${Number(value).toFixed(decimals)}%`;
};

// ── Large numbers — e.g. 1500000000 → "$1.50B" ──
export const formatMarketCap = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
};

// ── Plain large number no currency — e.g. 1500000 → "1.50M" ──
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (value >= 1e12) return `${(value / 1e12).toFixed(decimals)}T`;
  if (value >= 1e9)  return `${(value / 1e9).toFixed(decimals)}B`;
  if (value >= 1e6)  return `${(value / 1e6).toFixed(decimals)}M`;
  if (value >= 1e3)  return `${(value / 1e3).toFixed(decimals)}K`;
  return `${Number(value).toFixed(decimals)}`;
};

// ── Ratio — e.g. 24.5 → "24.5x" ──
export const formatMultiple = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${Number(value).toFixed(decimals)}x`;
};

// ── Plain decimal — e.g. 1.234567 → "1.23" ──
export const formatDecimal = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals);
};

// ── Sign-aware — prepends + for positive, – for negative ──
export const formatSigned = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const fixed = Number(value).toFixed(decimals);
  return value >= 0 ? `+${fixed}` : `${fixed}`;
};

// ── Date — e.g. "2024-01-15" → "Jan 15, 2024" ──
export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ── Returns CSS class name based on value sign ──
// Used for coloring metrics green/red
export const colorClass = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '';
  return value >= 0 ? 'positive' : 'negative';
};