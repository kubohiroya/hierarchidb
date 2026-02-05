/**
 * shape-plugin Test Setup
 * Uses base vitest setup configuration
 */

// Import base setup (includes _obsolate_common mocks and utilities)
import '../../vitest.setup.base';
import { setCorsProxyBaseURL } from '@hierarchidb/download';

// Default: run network integration tests directly in Node (no CORS proxy).
setCorsProxyBaseURL('');
// Package-specific setup can be added here if needed
