// Minimal type shims for packages that don't have proper exports
// Most types are now imported from actual packages

// Landing page component (if not exported properly)
declare module "@hierarchidb/app-landingpage" {
  export const LandingPage: any;
}