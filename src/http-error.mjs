export class HttpError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (body !== undefined) this.body = body;
  }
}
