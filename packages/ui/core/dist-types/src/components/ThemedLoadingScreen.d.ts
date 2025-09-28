import { type ReactNode } from 'react';
interface ThemedLoadingScreenProps {
    variant?: 'linear' | 'circular';
    message?: string;
    size?: number;
    children?: ReactNode;
}
export declare function ThemedLoadingScreen({ variant, message, size, children, }: ThemedLoadingScreenProps): JSX.Element;
export declare function ThemedLinearProgress(): JSX.Element;
export declare function ThemedCircularProgress({ message, size }: {
    message?: string;
    size?: number;
}): JSX.Element;
//# sourceMappingURL=ThemedLoadingScreen.d.ts.map