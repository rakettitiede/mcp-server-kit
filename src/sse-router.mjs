import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export function createSseRouter({ createServer }) {
  if (typeof createServer !== "function") {
    throw new Error("createSseRouter: `createServer` must be a function");
  }

  const router = express.Router();
  const sessions = {};

  router.get("/sse", async (req, res) => {
    try {
      const transport = new SSEServerTransport("/messages", res);
      sessions[transport.sessionId] = transport;

      console.log(
        `📡 [SSE] open session ${transport.sessionId} from ${req.ip}`,
      );
      res.on("close", () => {
        console.log(`📡 [SSE] closed ${transport.sessionId}`);
        try {
          transport.close?.();
        } catch {
          /* noop */
        }
        delete sessions[transport.sessionId];
      });

      const server = createServer();
      await server.connect(transport);
    } catch (err) {
      console.error("📡 [SSE] /sse init error:", err);
      if (!res.headersSent) res.status(500).send("SSE init error");
    }
  });

  router.post("/messages", async (req, res) => {
    try {
      const sid = String(req.query.sessionId || "");
      const transport = sessions[sid];
      if (!sid || !transport) {
        console.warn(
          `📡 [SSE] /messages missing or invalid sessionId: "${sid}"`,
        );
        res.status(400).send("Bad request");
        return;
      }
      await transport.handlePostMessage(req, res, req.body);
    } catch (err) {
      console.error("📡 [SSE] /messages error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: String(err?.message || err) },
          id: null,
        });
      }
    }
  });

  return router;
}
