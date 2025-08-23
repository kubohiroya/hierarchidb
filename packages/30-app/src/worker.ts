/**
 * Worker entry point for the application
 * This file serves as the worker entry that will be built by Vite
 */

// Import the actual worker implementation
// We need to use relative imports as this will be compiled as a separate worker bundle
import '../../02-worker/src/worker';