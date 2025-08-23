// import { LinkButton } from "@hierarchidb/ui-routing";
import React from 'react';
import { Button } from '@mui/material';
//import { APP_PREFIX } from "@/config/appDescription";
//import { EriaCartLogo } from "@/domains/src-config/containers/info/EriaCartLogo";

// to={`/${APP_PREFIX}/`}
// <EriaCartLogo size="large" />

interface BackActionButtonProps {
  isResourcesPage?: boolean;
  isProjectsPage?: boolean;
  to: string;
  children: React.ReactNode;
}

export function BackActionButton({
  isResourcesPage = false,
  isProjectsPage: _isProjectsPage = false,
  children,
  to,
}: BackActionButtonProps) {
  return (
    <Button
      onClick={() => (window.location.href = to)}
      variant="text"
      size="large"
      sx={{
        position: 'absolute',
        top: isResourcesPage ? 2 : 0,
        left: isResourcesPage ? 2 : 0,
        minWidth: 'auto',
        borderRadius: '50%',
        p: 0,
      }}
      aria-label="Back to Home"
      title="Back to Home"
    >
      {children}
    </Button>
  );
}
