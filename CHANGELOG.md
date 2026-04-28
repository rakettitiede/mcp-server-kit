# Changelog

## [1.3.0](https://github.com/rakettitiede/mcp-server-kit/compare/v1.2.0...v1.3.0) (2026-04-28)


### Features

* add openapi.operations config for per-operation summary/description overrides ([#14](https://github.com/rakettitiede/mcp-server-kit/issues/14)) ([9e701a7](https://github.com/rakettitiede/mcp-server-kit/commit/9e701a773aaabfbccc473a730c1c36a6fc531549))

## [1.2.0](https://github.com/rakettitiede/mcp-server-kit/compare/v1.1.0...v1.2.0) (2026-04-28)


### Features

* openapi 3.1.0, configurable refresh schemas, document 400 on refresh ([#12](https://github.com/rakettitiede/mcp-server-kit/issues/12)) ([8a4ebf0](https://github.com/rakettitiede/mcp-server-kit/commit/8a4ebf09a0853411f7807f4236a31d5452b0a528))

## [1.1.0](https://github.com/rakettitiede/mcp-server-kit/compare/v1.0.0...v1.1.0) (2026-04-27)


### Features

* honor err.status and err.body from handlers; export HttpError ([#10](https://github.com/rakettitiede/mcp-server-kit/issues/10)) ([95ccc26](https://github.com/rakettitiede/mcp-server-kit/commit/95ccc265e9b0bfcaecc15cbc32be3e7e5a50d8e4))

## 1.0.0 (2026-04-27)


### Features

* **api-router:** implement REST API handlers ([#6](https://github.com/rakettitiede/mcp-server-kit/issues/6)) ([667877e](https://github.com/rakettitiede/mcp-server-kit/commit/667877eb6a040826fd7f859821ccf502e276ff12))
* implement createMcpRouters facade with no-op routers ([#1](https://github.com/rakettitiede/mcp-server-kit/issues/1)) ([cddb060](https://github.com/rakettitiede/mcp-server-kit/commit/cddb0604feb1b62b716caf71d35cf26e81761324))
* implement createMcpServerFactory ([#2](https://github.com/rakettitiede/mcp-server-kit/issues/2)) ([5cf553c](https://github.com/rakettitiede/mcp-server-kit/commit/5cf553c5f9a130b82cee47eb9f348ebfd0f25078))
* **openapi-spec:** implement spec merging with consumer overrides ([#7](https://github.com/rakettitiede/mcp-server-kit/issues/7)) ([5143cad](https://github.com/rakettitiede/mcp-server-kit/commit/5143cadc6dc21a34b6e6093b3b7c0f7448846873))
* **sse-router:** implement real SSE transport ([#4](https://github.com/rakettitiede/mcp-server-kit/issues/4)) ([cf3972b](https://github.com/rakettitiede/mcp-server-kit/commit/cf3972b63e287cfdd88596b0279a3a82bda5d2e9))
* **streamable-http-router:** implement real Streamable HTTP transport ([#5](https://github.com/rakettitiede/mcp-server-kit/issues/5)) ([60cbc8d](https://github.com/rakettitiede/mcp-server-kit/commit/60cbc8d494307eff3af6474a87cde592788f72d6))
