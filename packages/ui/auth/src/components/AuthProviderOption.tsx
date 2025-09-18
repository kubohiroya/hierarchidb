import React from 'react';
import { AuthProviderType } from '../types/AuthProviderType.js';

export interface AuthProviderOption {
  type: AuthProviderType;
  name: string;
  icon: React.ReactElement;
  color: string;
  available: boolean;
}
