import type { Extract1Task } from '../../../../common/types/index.js';
import type { ShapeExtract1TaskInputData } from '@hierarchidb/plugin-service-api';

export const resolveContinent = (input?: ShapeExtract1TaskInputData): string | undefined => input?.continent;

export const resolveCountryName = (input?: ShapeExtract1TaskInputData): string | undefined => {
  const name = input?.countryName;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
};

export const resolveCountryCode = (task: Extract1Task, input?: ShapeExtract1TaskInputData): string | undefined => {
  const code = input?.countryCode ?? task.countryCode;
  return typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : undefined;
};

export const resolveAdminCode = (input?: ShapeExtract1TaskInputData): string | undefined => {
  const code = input?.adminCode ?? input?.featureGroupId;
  return typeof code === 'string' && code.trim() ? code.trim() : undefined;
};

export const getOriginKeyFromInput = (input?: ShapeExtract1TaskInputData): string | undefined => input?.originKey;

