import type React from 'react';
import type { ReactNode } from 'react';
export interface InfoContentProps {
    /**
     * The main title of the application
     */
    title: string;
    /**
     * A brief description of the application
     */
    description?: string;
    /**
     * Additional details or fun facts about the application
     */
    details?: string | ReactNode;
    /**
     * Attribution or copyright information
     */
    attribution?: string | ReactNode;
    /**
     * GitHub repository URL
     */
    githubUrl?: string;
    /**
     * Custom GitHub link text
     */
    githubLinkText?: string;
    /**
     * Additional footer content
     */
    footer?: ReactNode;
    /**
     * Variant for the title typography
     */
    titleVariant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    /**
     * Color for the title
     */
    titleColor?: string;
    /**
     * Color for the description
     */
    descriptionColor?: string;
    /**
     * Color for the details
     */
    detailsColor?: string;
}
/**
 * A generic component for displaying application information
 * with consistent styling and layout.
 */
export declare const InfoContent: ({ title, description, details, attribution, githubUrl, githubLinkText, footer, titleVariant, titleColor, descriptionColor, detailsColor, }: InfoContentProps) => React.ReactElement;
//# sourceMappingURL=InfoContent.d.ts.map