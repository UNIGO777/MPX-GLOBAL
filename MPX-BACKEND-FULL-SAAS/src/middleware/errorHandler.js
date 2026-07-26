import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

// Central error handler. Registered last. The client receives only a generic
// (or explicitly-safe) message plus the requestId; full detail is logged
// server-side keyed by that same requestId. A stack trace, a Mongo error string
// or a collection name must never cross this boundary.
// _next is required so Express recognises this as an error handler (arity 4).
export function errorHandler(err, req, res, _next) {
  const requestId = req.id;

  let statusCode = 500;
  let clientMessage = 'Something went wrong. Please try again.';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    clientMessage = err.clientMessage;
  } else {
    // Known framework errors (e.g. body-parser 400/413) carry a safe status but
    // an unsafe message. Honour the status; substitute a generic message.
    const status = err?.status ?? err?.statusCode;
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      statusCode = status;
      clientMessage = status === 413 ? 'Payload too large.' : 'Invalid request.';
    }
  }

  const log = logger.child({ requestId });
  const context = { err, method: req.method, url: req.originalUrl, statusCode };
  if (statusCode >= 500) {
    log.error(context, 'request failed');
  } else {
    log.warn(context, 'request rejected');
  }

  if (res.headersSent) {
    return _next(err);
  }

  res.status(statusCode).json({ error: { message: clientMessage, requestId } });
}
