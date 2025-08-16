import { ReactNode } from 'react';
import { Box, Typography, Link } from '@mui/material';

export interface InfoContentProps {
  /**
   * The logo or icon to display
   */
  logo?: ReactNode;
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
export const InfoContent = ({
  logo,
  title,
  description,
  details,
  attribution,
  githubUrl,
  githubLinkText = 'available on GitHub',
  footer,
  titleVariant = 'h3',
  titleColor = 'grey',
  descriptionColor = 'grey',
  detailsColor = 'lightGrey',
}: InfoContentProps) => {
  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Typography variant={titleVariant} component="h1" color={titleColor} textAlign="center">
        {logo && (
          <Box component="span" sx={{ mr: 1 }}>
            {logo}
          </Box>
        )}
        {title}
      </Typography>

      {description && (
        <Typography color={descriptionColor} sx={{ mb: 4, mt: 2 }}>
          {description}
        </Typography>
      )}

      {(details || attribution || githubUrl) && (
        <Box sx={{ fontSize: '11px', mt: 4 }}>
          {details && (
            <Typography color={detailsColor} sx={{ mb: 1 }}>
              {details}
            </Typography>
          )}

          {attribution && (
            <Typography color={detailsColor} sx={{ mb: 1 }}>
              {attribution}
            </Typography>
          )}

          {githubUrl && (
            <Typography color={detailsColor}>
              This software is published under open-source license and is{' '}
              <Link
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main' }}
              >
                {githubLinkText}
              </Link>
              .
            </Typography>
          )}
        </Box>
      )}
      {footer}
    </Box>
  );
};
