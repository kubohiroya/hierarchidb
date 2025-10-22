declare module 'react-gravatar' {
  import type { ComponentType, ImgHTMLAttributes } from 'react';

  export interface GravatarProps extends ImgHTMLAttributes<HTMLImageElement> {
    email?: string;
    md5?: string;
    https?: boolean;
    default?: string;
    rating?: 'g' | 'pg' | 'r' | 'x';
    size?: number | string;
    protocol?: 'http' | 'https';
    className?: string;
    alt?: string;
  }

  const Gravatar: ComponentType<GravatarProps>;
  export default Gravatar;
}
