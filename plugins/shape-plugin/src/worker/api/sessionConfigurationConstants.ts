/**
 * Session Configuration
 *
 * Handles build session configuration resolution and mapping
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { BuildSessionConfig, BuildSessionRecord } from '@hierarchidb/shape-store';
import type { ShapeRuntimeBuildConfig } from '~/common/types/BuildTaskResult';
import { BuildSession } from '~/common/types/BuildTaskResult';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '~/common/types/constants';
import { requireDataSourceName } from '~/common/types/data-source';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { toBuildSessionRecord } from '~/services/build/shapeSessionMapperUtils';
import {
  applyBuildConfigPatch,
  composeRuntimeBuildConfig,
  mergeProcessingConfig,
} from '~/services/utils/shapeBuildUtils';
import { ShapeEntityService as ShapeEntityHandler } from '../handlers/ShapeEntityService.js';

// Singleton entity handler
const shapeEntityHandlerSingleton = new ShapeEntityHandler();
export const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

// Build session configuration and mapping
const mapBuildSessionRecordToBuildSession = (
  record: BuildSessionRecord,
  config: BuildSessionConfig
): BuildSession => ({
  nodeId: record.nodeId,
  status: record.status,
  config,
  startedAt: record.startedAt,
  updatedAt: record.updatedAt,
  completedAt: record.completedAt,
  inactiveMs: record.inactiveMs,
  lastHeartbeatAt: record.lastHeartbeatAt,
  stageInactiveMs: record.stageInactiveMs,
  stageStartedAt: record.stageStartedAt,
  stageId: record.stageId,
  progress: record.progress,
  canResume: record.canResume,
  lastActivity: record.lastActivity ?? record.updatedAt,
  expiresAt: record.expiresAt,
  stages: record.stages,
  resourceUsage: record.resourceUsage,
});

const resolveBuildSessionConfig = async (nodeId: NodeId): Promise<BuildSessionConfig> => {
  const handler = getShapeEntityHandler();
  const entity = await handler.getEntity(nodeId);
  const mergedBuildConfig = applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, entity?.buildConfig ?? {});
  const mergedProcessingConfig = mergeProcessingConfig(
    DEFAULT_PROCESSING_CONFIG,
    entity?.processingConfig ?? {}
  );
  return buildBuildSessionConfig(
    composeRuntimeBuildConfig(mergedBuildConfig, mergedProcessingConfig)
  );
};

const buildBuildSessionConfig = (buildConfig: ShapeRuntimeBuildConfig): BuildSessionConfig => {
  const resolvedDataSource = requireDataSourceName(
    buildConfig.dataSourceName,
    'buildBuildSessionConfig'
  );
  return {
    dataSource: resolvedDataSource,
    sourceConfig: buildConfig.sourceConfig,
    geometryConfig: buildConfig.geometryConfig,
    vectorTiles: buildConfig.tileEmitConfig,
    borderGeometryConfig: buildConfig.borderGeometryConfig,
  };
};

export const resolveSessionExpiresAt = (lastActivity: number): number =>
  lastActivity + 5 * 60 * 1000;

export const getBuildSessionInternal = async (
  nodeId: NodeId
): Promise<BuildSession | undefined> => {
  const config = await resolveBuildSessionConfig(nodeId);
  const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
  const buildSession = sessionRecord ? toBuildSessionRecord(sessionRecord) : null;
  return buildSession ? mapBuildSessionRecordToBuildSession(buildSession, config) : undefined;
};
