import express from "express";

export function createApiRouter({ search, fetch: fetchFn, refresh, openapiSpec }) {
  if (typeof search !== "function") {
    throw new Error("createApiRouter: `search` must be a function");
  }
  if (typeof fetchFn !== "function") {
    throw new Error("createApiRouter: `fetch` must be a function");
  }
  if (refresh !== undefined && typeof refresh !== "function") {
    throw new Error("createApiRouter: `refresh` must be a function when provided");
  }

  const router = express.Router();

  router.get("/api/v1/search", async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(400).json({ error: "Missing query parameter ?q=" });
    }
    try {
      const { results } = await search(q);
      res.json({ results, count: results.length });
    } catch (err) {
      console.error(`🔴 REST /search failed for q=${JSON.stringify(q)}: ${err.message}`, err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  router.get("/api/v1/fetch", async (req, res) => {
    const id = String(req.query.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Missing query parameter ?id=" });
    }
    try {
      const doc = await fetchFn(id);
      res.json(doc);
    } catch (err) {
      console.error(`🔴 REST /fetch failed for id=${JSON.stringify(id)}: ${err.message}`, err);
      res.status(500).json({ error: "Fetch failed" });
    }
  });

  if (refresh) {
    router.post("/api/v1/refresh", async (req, res) => {
      try {
        const result = await refresh(req.body);
        res.json(result ?? { ok: true });
      } catch (err) {
        console.error(`🔴 REST /refresh failed: ${err.message}`, err);
        res.status(500).json({ error: "Refresh failed" });
      }
    });
  }

  router.get("/openapi.json", (req, res) => {
    res.json(openapiSpec);
  });

  return router;
}
