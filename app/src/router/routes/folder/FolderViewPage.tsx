/**
 * FolderViewPage — renders TreeConsoleRoutePage with viewMode/sortMode from URL path params.
 */

import { useLoaderData, useParams } from '@tanstack/react-router';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { TreeConsoleRoutePage } from '~/router/pages/tree/console/TreeConsoleRoutePage';

const VALID_VIEW_MODES = new Set(['icon', 'list', 'column']);
const VALID_SORT_MODES = new Set([
    'none', 'name', 'type', 'lastOpened', 'created', 'modified', 'size', 'tag',
]);

export function FolderViewPage() {
    const data = useLoaderData({ strict: false }) as LoadPageNodeReturn;
    const params = useParams({ strict: false }) as {
        viewMode?: string;
        sortMode?: string;
        targetNodeId?: string;
    };

    const viewMode = VALID_VIEW_MODES.has(params.viewMode ?? '')
        ? (params.viewMode as 'icon' | 'list' | 'column')
        : 'list';
    const sortMode = VALID_SORT_MODES.has(params.sortMode ?? '')
        ? params.sortMode
        : 'name';

    return (
        <TreeConsoleRoutePage
            data={data}
            viewMode={viewMode}
            sortMode={sortMode}
        />
    );
}
