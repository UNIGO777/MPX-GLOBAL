// Typed application error. `statusCode` drives the HTTP response; `clientMessage`
// is the ONLY text ever returned to the caller — it must never contain internal
// detail (stack, Mongo text, collection names, identifiers). The `message` (for
// server-side logs) may carry detail; the client message may not.
export class AppError extends Error {
  constructor(
    message,
    { statusCode = 500, clientMessage = 'Something went wrong.', code, isOperational = true, details } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.clientMessage = clientMessage;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message, clientMessage = 'Invalid request.', code) {
    return new AppError(message, { statusCode: 400, clientMessage, code });
  }

  static unauthorized(message, clientMessage = 'Authentication required.', code) {
    return new AppError(message, { statusCode: 401, clientMessage, code });
  }

  static forbidden(message, clientMessage = 'Not allowed.', code) {
    return new AppError(message, { statusCode: 403, clientMessage, code });
  }

  // Ownership rule: a record the caller does not own is reported as 404, never
  // 403 — a 403 would confirm the record exists.
  static notFound(message, clientMessage = 'Not found.', code) {
    return new AppError(message, { statusCode: 404, clientMessage, code });
  }

  static conflict(message, clientMessage = 'Conflict.', code) {
    return new AppError(message, { statusCode: 409, clientMessage, code });
  }
}
