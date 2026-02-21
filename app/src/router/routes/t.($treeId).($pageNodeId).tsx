import { useLoaderData } from '@tanstack/react-router';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { TreeConsoleRoutePage } from '~/router/pages/tree/console/TreeConsoleRoutePage';

type TreeLayoutBodyProps = {
  data: LoadPageNodeReturn;
};

export default function TLayout() {
  const data = useLoaderData({ from: '/t/$treeId/$pageNodeId' }) as LoadPageNodeReturn;
  return <TreeConsoleRoutePage data={data} />;
}

export function TreeLayoutBody({ data }: TreeLayoutBodyProps) {
  return <TreeConsoleRoutePage data={data} />;
}
