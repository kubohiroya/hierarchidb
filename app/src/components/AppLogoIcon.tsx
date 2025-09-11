import React from 'react';

interface AppLogoIconProps {
  size?: number; // px
}

/**
 * Small, self-contained SVG icon that matches the top page logo motif.
 * Pure SVG (no layout), safe for use inside MUI IconButton.
 */
export const AppLogoIcon: React.FC<AppLogoIconProps> = ({ size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    aria-hidden
    focusable={false}
  >
    {/* Top node */}
    <circle cx="40" cy="15" r="8" fill="#1976d2" />
    {/* Connections to middle */}
    <line x1="40" y1="23" x2="25" y2="32" stroke="#1976d2" strokeWidth="2" />
    <line x1="40" y1="23" x2="55" y2="32" stroke="#1976d2" strokeWidth="2" />
    {/* Middle nodes */}
    <circle cx="25" cy="40" r="8" fill="#42a5f5" />
    <circle cx="55" cy="40" r="8" fill="#42a5f5" />
    {/* Connections to bottom */}
    <line x1="25" y1="48" x2="15" y2="57" stroke="#42a5f5" strokeWidth="2" />
    <line x1="25" y1="48" x2="32" y2="57" stroke="#42a5f5" strokeWidth="2" />
    <line x1="55" y1="48" x2="48" y2="57" stroke="#42a5f5" strokeWidth="2" />
    <line x1="55" y1="48" x2="65" y2="57" stroke="#42a5f5" strokeWidth="2" />
    {/* Bottom nodes */}
    <circle cx="15" cy="65" r="6" fill="#90caf9" />
    <circle cx="32" cy="65" r="6" fill="#90caf9" />
    <circle cx="48" cy="65" r="6" fill="#90caf9" />
    <circle cx="65" cy="65" r="6" fill="#90caf9" />
  </svg>
);

export default AppLogoIcon;

