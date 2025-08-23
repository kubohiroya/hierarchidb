/**
 * Material-UI Theme Configuration
 */
// @ts-ignore - ui-theme package not properly configured yet
import { Theme } from "@emotion/react";
import { createAppTheme } from "@hierarchidb/10-ui-theme";

// Export the default light theme
export const defaultTheme: Theme = createAppTheme("light");
