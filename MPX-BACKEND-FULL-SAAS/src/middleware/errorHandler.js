import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { ErrorLog } from '../models/ErrorLog.js';
import { redactSecrets } from '../utils/redact.js';

// A19: persist 5xx errors to the `errorLogs` collection (90-day TTL).
// Fire-and-forget — a logging failure must NEVER affect the response — and the
// exclusion list is enforced by construction: only these shaped fields are ever
// written (no bodies, no headers, no KYC/tokens/OTPs/contact).
//
// F5 — `message` and `stack` are the two fields we do NOT control the shape of:
// they come from whatever threw. A driver error quotes its own connection string,
// which in production carries the database password. Since F5's viewer shows both
// to `errorlog:read`, they are redacted here, at the write site, so the secret
// never reaches the collection at all (see utils/redact.js).
export function persistErrorLog({ err, req, statusCode }) {
  return ErrorLog.create({
    statusCode,
    message: redactSecrets(err?.message),
    stack: redactSecrets(err?.stack),
    route: req.originalUrl,
    method: req.method,
    requestId: req.id,
    userId: req.user?.userId ?? undefined,
    orgId: req.user?.orgId ?? undefined,
    occurredAt: new Date(),
  }).catch((persistErr) => {
    logger.warn(
      { err: { name: persistErr?.name, message: persistErr?.message } },
      'errorLogs persist failed (response unaffected)',
    );
  });
}

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
    persistErrorLog({ err, req, statusCode }); // A19 — errors only, never awaited
  } else {
    log.warn(context, 'request rejected');
  }

  if (res.headersSent) {
    return _next(err);
  }

  res.status(statusCode).json({ error: { message: clientMessage, requestId } });
}
