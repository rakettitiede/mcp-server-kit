import { randomUUID } from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export function createStreamableHttpRouter({ createServer }) {
  if (typeof createServer !== "function") {
    throw new Error(
      "createStreamableHttpRouter: `createServer` must be a function",
    );
  }

  const router = express.Router();
  const sessions = {};

  router.post("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"];

      if (sessionId) {
        const session = sessions[sessionId];
        if (!session) {
          res.status(400).json({ error: "Invalid or expired session" });
          return;
        }
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      const newSessionId = randomUUID();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });

      const server = createServer();

      sessions[newSessionId] = { transport, server };
      console.log(
        `🔗 [Streamable HTTP] open session ${newSessionId} from ${req.ip}`,
      );

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
    }
  });

  router.get("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"];
      if (!sessionId) {
        res.status(400).json({ error: "mcp-session-id header required" });
        return;
      }
      const session = sessions[sessionId];
      if (!session) {
        res.status(400).json({ error: "Invalid or expired session" });
        return;
      }
      console.log(
        `🔗 [Streamable HTTP] GET SSE stream for session ${sessionId}`,
      );
      await session.transport.handleRequest(req, res);
    } catch (err) {
      console.error("🔗 [Streamable HTTP] GET /mcp error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: String(err?.message || err) });
      }
    }
  });

  router.delete("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"];
      if (!sessionId) {
        res.status(400).json({ error: "mcp-session-id header required" });
        return;
      }
      const session = sessions[sessionId];
      if (!session) {
        res.status(400).json({ error: "Invalid or expired session" });
        return;
      }
      console.log(`🔗 [Streamable HTTP] closing session ${sessionId}`);
      try {
        await session.transport.close?.();
      } catch {
        /* noop */
      }
      try {
        await session.server.close?.();
      } catch {
        /* noop */
      }
      delete sessions[sessionId];
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("🔗 [Streamable HTTP] DELETE /mcp error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: String(err?.message || err) });
      }
    }
  });

  return router;
}
