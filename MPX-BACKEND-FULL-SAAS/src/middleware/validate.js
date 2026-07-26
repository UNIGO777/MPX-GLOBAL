/**
 * Request validation, run before any controller. `validate({ body, query,
 * params })` takes a zod schema per request part (any subset). Each part is
 * parsed; zod objects strip unknown keys by default, so validated output carries
 * only declared fields. On failure the whole request is rejected with a 400 and
 * field-level errors (safe to return — they describe the caller's own input).
 *
 * Validated data is exposed on `req.validated`. The writable parts (body, params)
 * are also replaced in place so downstream code only sees cleaned input. req.query
 * is left alone — Express 5 exposes it as a read-only getter — so read a validated
 * query from `req.validated.query`.
 */
const PARTS = ['body', 'query', 'params'];

export function validate(schemas) {
  return function validateRequest(req, res, next) {
    const errors = [];
    const validated = {};

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (result.success) {
        validated[part] = result.data;
        continue;
      }
      for (const issue of result.error.issues) {
        const field = issue.path.length ? `${part}.${issue.path.join('.')}` : part;
        errors.push({ field, message: issue.message });
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: { message: 'Invalid request.', requestId: req.id ?? null, fields: errors },
      });
      return;
    }

    if ('body' in validated) req.body = validated.body;
    if ('params' in validated) req.params = validated.params;
    req.validated = validated;
    next();
  };
}
