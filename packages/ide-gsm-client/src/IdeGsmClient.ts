import { GraphQLClient, gql } from 'graphql-request';
import { createClient } from 'graphql-ws';
import type { Client as WsClient } from 'graphql-ws';
import type { ExportFilter, TaskResult, TaskStatus } from './ideGsmTypes.js';

/** Factory type for creating a graphql-ws client. Injected for testability. */
export type WsClientFactory = (url: string, connectionParams: Record<string, string>) => WsClient;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive the WebSocket URL from an HTTP endpoint URL.
 * - http://  → ws://
 * - https:// → wss://
 * The path /graphql is always appended to the base URL.
 */
export function deriveWsUrl(endpointUrl: string): string {
    const withoutTrailingSlash = endpointUrl.replace(/\/+$/, '');
    if (withoutTrailingSlash.startsWith('https://')) {
        return `wss://${withoutTrailingSlash.slice('https://'.length)}/graphql`;
    }
    if (withoutTrailingSlash.startsWith('http://')) {
        return `ws://${withoutTrailingSlash.slice('http://'.length)}/graphql`;
    }
    throw new Error(
        `Unsupported endpoint URL scheme: ${endpointUrl}. Only http:// and https:// are supported.`
    );
}

/** Build the Authorization header object for a given auth token. */
function buildAuthHeaders(authToken: string): Record<string, string> {
    return { Authorization: `Bearer ${authToken}` };
}

// ---------------------------------------------------------------------------
// GraphQL documents
// ---------------------------------------------------------------------------

const IMPORT_PROJECT = gql`
  mutation ImportProject($projectSnapshot: String!, $projectRelativePath: String!) {
    importProject(input: { projectSnapshot: $projectSnapshot, projectRelativePath: $projectRelativePath })
  }
`;

const CALIBRATE = gql`
  mutation Calibrate($projectRelativePath: String!) {
    calibrate(input: { projectRelativePath: $projectRelativePath })
  }
`;

const SIMULATE = gql`
  mutation Simulate($projectRelativePath: String!) {
    simulate(input: { projectRelativePath: $projectRelativePath })
  }
`;

const EXPORT_PROJECT = gql`
  mutation ExportProject($projectRelativePath: String!, $include: [String!], $exclude: [String!]) {
    exportProject(input: { projectRelativePath: $projectRelativePath, include: $include, exclude: $exclude })
  }
`;

const SUBSCRIBE_TASK = gql`
  subscription SubscribeTask($taskId: String!) {
    subscribeTaskOnFrontend(taskId: $taskId) {
      id
      status
      paramsJson
    }
  }
`;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface ImportProjectResponse {
    importProject: string;
}

interface CalibrateResponse {
    calibrate: string;
}

interface SimulateResponse {
    simulate: string;
}

interface ExportProjectResponse {
    exportProject: string;
}

interface SubscribeTaskEvent {
    subscribeTaskOnFrontend: TaskResult;
}

// ---------------------------------------------------------------------------
// IdeGsmClient
// ---------------------------------------------------------------------------

/**
 * Client for the IDE-GSM GraphQL API.
 *
 * Provides typed, Promise-based methods for triggering long-running tasks
 * (importProject, calibrate, simulate, exportProject) via HTTP mutations and
 * awaiting their completion via WebSocket subscriptions (awaitTask).
 */
export class IdeGsmClient {
    private readonly endpointUrl: string;
    private readonly authToken: string;
    private readonly graphqlUrl: string;
    private readonly wsClientFactory: WsClientFactory;

    constructor(
        endpointUrl: string,
        authToken: string,
        wsClientFactory?: WsClientFactory,
    ) {
        this.endpointUrl = endpointUrl;
        this.authToken = authToken;
        const base = endpointUrl.replace(/\/+$/, '');
        this.graphqlUrl = `${base}/graphql`;
        this.wsClientFactory = wsClientFactory ?? ((url, params) =>
            createClient({ url, connectionParams: params })
        );
    }

    // -------------------------------------------------------------------------
    // Private: create a one-shot GraphQLClient
    // -------------------------------------------------------------------------

    private createHttpClient(): GraphQLClient {
        return new GraphQLClient(this.graphqlUrl, {
            headers: buildAuthHeaders(this.authToken),
        });
    }

    // -------------------------------------------------------------------------
    // Mutations
    // -------------------------------------------------------------------------

    /**
     * Import a project snapshot into IDE-GSM.
     * @returns The taskId of the started async task.
     */
    async importProject(
        projectSnapshot: string,
        projectRelativePath: string,
    ): Promise<string> {
        const client = this.createHttpClient();
        const data = await client.request<ImportProjectResponse>(IMPORT_PROJECT, {
            projectSnapshot,
            projectRelativePath,
        });
        return data.importProject;
    }

    /**
     * Start a calibration task for the given project.
     * @returns The taskId of the started async task.
     */
    async calibrate(projectRelativePath: string): Promise<string> {
        const client = this.createHttpClient();
        const data = await client.request<CalibrateResponse>(CALIBRATE, {
            projectRelativePath,
        });
        return data.calibrate;
    }

    /**
     * Start a simulation task for the given project.
     * @returns The taskId of the started async task.
     */
    async simulate(projectRelativePath: string): Promise<string> {
        const client = this.createHttpClient();
        const data = await client.request<SimulateResponse>(SIMULATE, {
            projectRelativePath,
        });
        return data.simulate;
    }

    /**
     * Export a project from IDE-GSM.
     * When filter is omitted, IDE-GSM applies its own default include/exclude rules.
     * @returns The taskId of the started async task.
     */
    async exportProject(
        projectRelativePath: string,
        filter?: ExportFilter,
    ): Promise<string> {
        const client = this.createHttpClient();

        // Only include filter fields in variables when they are explicitly provided.
        const variables: Record<string, unknown> = { projectRelativePath };
        if (filter?.include !== undefined) {
            variables['include'] = filter.include;
        }
        if (filter?.exclude !== undefined) {
            variables['exclude'] = filter.exclude;
        }

        const data = await client.request<ExportProjectResponse>(
            EXPORT_PROJECT,
            variables,
        );
        return data.exportProject;
    }

    // -------------------------------------------------------------------------
    // Subscription
    // -------------------------------------------------------------------------

    /**
     * Wait for an IDE-GSM async task to reach a terminal status.
     *
     * Resolves with the TaskResult when status is FINISHED.
     * Throws when status is FAILED or CANCELED.
     * Throws when the WebSocket connection closes before a terminal status is received.
     */
    awaitTask(taskId: string): Promise<TaskResult> {
        return new Promise<TaskResult>((resolve, reject) => {
            const wsUrl = deriveWsUrl(this.endpointUrl);
            const wsClient = this.wsClientFactory(wsUrl, buildAuthHeaders(this.authToken));

            const unsubscribe = wsClient.subscribe<SubscribeTaskEvent>(
                {
                    query: SUBSCRIBE_TASK,
                    variables: { taskId },
                },
                {
                    next: (event) => {
                        const result = event.data?.subscribeTaskOnFrontend;
                        if (result === undefined || result === null) return;

                        const status: TaskStatus = result.status;

                        if (status === 'FINISHED') {
                            unsubscribe();
                            wsClient.dispose();
                            resolve(result);
                            return;
                        }

                        if (status === 'FAILED' || status === 'CANCELED') {
                            unsubscribe();
                            wsClient.dispose();
                            reject(
                                new Error(`Task ${taskId} failed with status ${status}`),
                            );
                        }
                    },
                    error: (err) => {
                        reject(
                            new Error(
                                `WebSocket error while awaiting task ${taskId}: ${String(err)}`,
                            ),
                        );
                    },
                    complete: () => {
                        // The subscription completed without a terminal status event.
                        reject(
                            new Error(
                                `WebSocket closed before task ${taskId} completed`,
                            ),
                        );
                    },
                },
            );
        });
    }
}
