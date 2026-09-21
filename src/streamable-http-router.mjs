import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export function createStreamableHttpRouter({ createServer }) {
  if (typeof createServer !== "function") {
    throw new Error(
      "createStreamableHttpRouter: `createServer` must be a function",
    );
  }

  const router = express.Router();

  router.post("/mcp", async (req, res) => {
    let transport;
    let server;
    try {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      server = createServer();

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("🔗 [Streamable HTTP] POST /mcp error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: String(err?.message || err) },
          id: null,
        });
      }
    } finally {
      await Promise.allSettled([
        transport?.close?.(),
        server?.close?.(),
      ]);
    }
  });

  router.get("/mcp", (_req, res) => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({ error: "Method not allowed" });
  });

  router.delete("/mcp", (_req, res) => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({ error: "Method not allowed" });
  });

  return router;
}
