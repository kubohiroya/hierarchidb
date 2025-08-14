import { ReactNode } from 'react';
interface ThemedLoadingScreenProps {
  variant?: 'linear' | 'circular';
  message?: string;
  size?: number;
  children?: ReactNode;
}
export declare function ThemedLoadingScreen({
  variant,
  message,
  size,
  children,
}: ThemedLoadingScreenProps): import('react/jsx-runtime').JSX.Element;
export declare function ThemedLinearProgress(): import('react/jsx-runtime').JSX.Element;
export declare function ThemedCircularProgress({
  message,
  size,
}: {
  message?: string;
  size?: number;
}): import('react/jsx-runtime').JSX.Element;
export {};
//# sourceMappingURL=ThemedLoadingScreen.d.ts.map
