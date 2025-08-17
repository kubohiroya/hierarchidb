import React from 'react';

export const EriaCartLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" fill="currentColor" />
    </svg>
  );
};

export default EriaCartLogo;
