const RESERVED_SCHEMA_NAMES = ["Document", "SearchResult", "SearchResponse", "Error"];

const DEFAULT_TEXT_SCHEMA = { type: "object", additionalProperties: true };
const DEFAULT_METADATA_SCHEMA = { type: "object", additionalProperties: true };

function buildPaths({ hasRefresh, refreshRequestSchema, refreshResponseSchema, searchOp, fetchOp, refreshOp }) {
  const paths = {
    "/api/v1/search": {
      get: {
        operationId: "Search",
        summary: searchOp.summary ?? "Search for records",
        ...(searchOp.description !== undefined && { description: searchOp.description }),
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 1 },
            description: "Free-text search query",
          },
        ],
        responses: {
          200: {
            description: "Matching records",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SearchResponse" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/v1/fetch": {
      get: {
        operationId: "Fetch",
        summary: fetchOp.summary ?? "Fetch a full record by ID",
        ...(fetchOp.description !== undefined && { description: fetchOp.description }),
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 1 },
            description: "Record ID returned from search",
          },
        ],
        responses: {
          200: {
            description: "The requested document",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Document" },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    },
  };

  if (hasRefresh) {
    const reqRequired = Array.isArray(refreshRequestSchema.required) && refreshRequestSchema.required.length > 0;
    paths["/api/v1/refresh"] = {
      post: {
        operationId: "Refresh",
        summary: refreshOp.summary ?? "Refresh the underlying data source",
        ...(refreshOp.description !== undefined && { description: refreshOp.description }),
        requestBody: {
          required: reqRequired,
          content: {
            "application/json": {
              schema: refreshRequestSchema,
            },
          },
        },
        responses: {
          200: {
            description: "Refresh result",
            content: {
              "application/json": {
                schema: refreshResponseSchema,
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          500: { $ref: "#/components/responses/ServerError" },
        },
      },
    };
  }

  return paths;
}

function buildSchemas({ textSchema, metadataSchema }) {
  return {
    Document: {
      type: "object",
      required: ["id", "title", "text", "url"],
      properties: {
        id: { type: "string", description: "Stable identifier for this record" },
        title: { type: "string", description: "Short human-readable title" },
        text: textSchema,
        url: { type: "string", description: "Canonical URL for this record" },
        metadata: metadataSchema,
      },
    },
    SearchResult: {
      type: "object",
      required: ["id", "title", "url"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        url: { type: "string" },
      },
    },
    SearchResponse: {
      type: "object",
      required: ["results", "count"],
      properties: {
        results: {
          type: "array",
          items: { $ref: "#/components/schemas/SearchResult" },
        },
        count: { type: "integer", minimum: 0 },
      },
    },
    Error: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
    },
  };
}

const RESERVED_RESPONSES = {
  BadRequest: {
    description: "Bad request",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  },
  ServerError: {
    description: "Server error",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  },
};

export function buildOpenapiSpec({ name, version, hasRefresh, openapi = {} }) {
  if (openapi.openapi !== undefined) {
    throw new Error("createMcpRouters: `openapi.openapi` is package-owned and cannot be overridden");
  }
  if (openapi.paths !== undefined) {
    throw new Error("createMcpRouters: `openapi.paths` is package-owned and cannot be overridden");
  }
  if (openapi.schemas) {
    for (const reserved of RESERVED_SCHEMA_NAMES) {
      if (reserved in openapi.schemas) {
        throw new Error(
          `createMcpRouters: schema name "${reserved}" is reserved by the package and cannot be overridden`,
        );
      }
    }
  }

  const consumerSchemas = openapi.schemas || {};
  const textSchema = openapi.textSchema || DEFAULT_TEXT_SCHEMA;
  const metadataSchema = openapi.metadataSchema || DEFAULT_METADATA_SCHEMA;
  const refreshRequestSchema = openapi.refreshRequestSchema || { type: "object" };
  const refreshResponseSchema = openapi.refreshResponseSchema || { type: "object" };
  const operations = openapi.operations ?? {};
  const searchOp = operations.search ?? {};
  const fetchOp = operations.fetch ?? {};
  const refreshOp = operations.refresh ?? {};

  const spec = {
    openapi: "3.1.0",
    info: {
      title: name,
      version,
      ...(openapi.info || {}),
    },
    paths: buildPaths({ hasRefresh, refreshRequestSchema, refreshResponseSchema, searchOp, fetchOp, refreshOp }),
    components: {
      schemas: {
        ...buildSchemas({ textSchema, metadataSchema }),
        ...consumerSchemas,
      },
      responses: { ...RESERVED_RESPONSES },
    },
  };

  if (openapi.servers) {
    spec.servers = openapi.servers;
  }

  return spec;
}
