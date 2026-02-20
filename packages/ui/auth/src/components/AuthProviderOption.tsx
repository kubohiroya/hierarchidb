import type React from 'react';
import type { AuthProviderType } from '~/types/AuthProviderType';

export interface AuthProviderOption {
  type: AuthProviderType;
  name: string;
  icon: React.ReactElement;
  color: string;
  available: boolean;
}
