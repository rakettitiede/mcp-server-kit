import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DEFAULT_SEARCH_DESC = "Search records by query";
const DEFAULT_FETCH_DESC = "Fetch a full record by ID returned from search";
const DEFAULT_REFRESH_DESC =
  "Rebuild the searchable snapshot from the upstream source. Takes several minutes. " +
  "Call only when the user explicitly asks to refresh/rebuild/sync the database or snapshot. " +
  "Do not call for a new search, 'refresh the list', 'look again', 'more candidates', missing people, or stale-looking results.";

export function createMcpServerFactory({
  name,
  version,
  search,
  fetch: fetchFn,
  refresh,
  registerRefreshTool = false,
  searchDescription = DEFAULT_SEARCH_DESC,
  fetchDescription = DEFAULT_FETCH_DESC,
  refreshDescription = DEFAULT_REFRESH_DESC,
}) {
  if (!name) throw new Error("createMcpServerFactory: `name` is required");
  if (!version)
    throw new Error("createMcpServerFactory: `version` is required");
  if (typeof search !== "function")
    throw new Error("createMcpServerFactory: `search` must be a function");
  if (typeof fetchFn !== "function")
    throw new Error("createMcpServerFactory: `fetch` must be a function");
  if (registerRefreshTool && typeof refresh !== "function") {
    throw new Error(
      "createMcpServerFactory: `refresh` must be a function when `registerRefreshTool` is true",
    );
  }

  return function createServer() {
    const srv = new McpServer({ name, version });

    srv.registerTool(
      "search",
      {
        title: "Search",
        description: searchDescription,
        inputSchema: { query: z.string().min(1) },
      },
      async ({ query }) => {
        try {
          const { results } = await search(query);
          return {
            content: [{ type: "text", text: JSON.stringify({ results }) }],
          };
        } catch (error) {
          console.error(`🔴 MCP search tool failed for query=${JSON.stringify(query)}: ${error.message}`, error);
          return {
            content: [{ type: "text", text: JSON.stringify({ results: [] }) }],
          };
        }
      },
    );

    srv.registerTool(
      "fetch",
      {
        title: "Fetch",
        description: fetchDescription,
        inputSchema: { id: z.string().min(1) },
      },
      async ({ id }) => {
        try {
          const doc = await fetchFn(id);
          return { content: [{ type: "text", text: JSON.stringify(doc) }] };
        } catch (error) {
          console.error(`🔴 MCP fetch tool failed for id=${JSON.stringify(id)}: ${error.message}`, error);
          throw error;
        }
      },
    );

    if (registerRefreshTool) {
      srv.registerTool(
        "refresh",
        {
          title: "Refresh",
          description: refreshDescription,
          inputSchema: {},
        },
        async () => {
          try {
            const result = await refresh({});
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result ?? { ok: true }),
                },
              ],
            };
          } catch (error) {
            console.error(`🔴 MCP refresh tool failed: ${error.message}`, error);
            throw error;
          }
        },
      );
    }

    return srv;
  };
}
