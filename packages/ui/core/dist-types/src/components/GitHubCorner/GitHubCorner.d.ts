/**
 * @file GitHubCorner.tsx
 * @description A decorative GitHub corner link component that displays the iconic
 * "Fork me on GitHub" ribbon in the top-right corner. Features an animated octopus
 * arm that waves on hover.
 *
 * @module components/ui/GitHubCorner
 *
 * @usage
 * - Application root layout (root.tsx)
 * - Landing pages requiring GitHub repository links
 * - Open source project showcases
 *
 * @dependencies
 * - React: Basic component functionality
 * - CSS: Hover animations defined in global styles
 */
import React from 'react';
interface GitHubCornerProps {
    url: string;
    visible?: boolean;
}
declare const GitHubCorner: ({ url, visible }: GitHubCornerProps) => React.ReactElement | null;
export default GitHubCorner;
//# sourceMappingURL=GitHubCorner.d.ts.map