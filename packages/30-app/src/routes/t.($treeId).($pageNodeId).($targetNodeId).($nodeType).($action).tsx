import { Outlet, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { loadTreeNodeAction, LoadTreeNodeActionArgs } from "~/loader";

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadTreeNodeAction(args.params as LoadTreeNodeActionArgs);
}

export default function TLayout() {
  const data = useLoaderData();
  if (!data.action) {
    return;
  }
  return (
    <div>
      <div
        style={{ padding: "20px", border: "1px solid #ccc", margin: "10px" }}
      >
        <h5>Route Parameters</h5>
        <ul>
          <li>
            <strong>Tree ID:</strong> {data.tree.id || "Not provided"}
          </li>
          <li>
            <strong>Page Tree Node ID:</strong>{" "}
            {data.pageTreeNode.id || "Not provided"}
          </li>
          <li>
            <strong>Target Tree Node ID:</strong>{" "}
            {data.targetTreeNode.id || "Not provided"}
          </li>
          <li>
            <strong>Tree Node Type:</strong>{" "}
            {data.nodeType || "Not provided"}
          </li>
          <li>
            <strong>Action:</strong> {data.action || "Not provided"}
          </li>
        </ul>
      </div>
      <Outlet />
    </div>
  );
}
