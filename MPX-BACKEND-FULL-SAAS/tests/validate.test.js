import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import { validate } from '../src/middleware/validate.js';
import { zString } from '../src/validators/helpers.js';

// Minimal app: a login route whose body is validated with the strict string
// helper, mirroring how real routes will wire validation before a controller.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.id = 'test-request-id';
    next();
  });
  app.post(
    '/login',
    validate({ body: z.object({ email: zString(), password: zString({ min: 8 }) }) }),
    (req, res) => res.json({ ok: true, body: req.body }),
  );
  return app;
}

describe('validate + zString — NoSQL operator injection', () => {
  it('rejects an object ({ $gt: "" }) supplied for a string field', async () => {
    const res = await request(buildApp())
      .post('/login')
      .send({ email: 'buyer@example.com', password: { $gt: '' } });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid request.');
    // The password field is flagged, and the operator never reaches a controller.
    const fields = res.body.error.fields.map((f) => f.field);
    expect(fields).toContain('body.password');
  });

  it('rejects an object for the email field too', async () => {
    const res = await request(buildApp())
      .post('/login')
      .send({ email: { $ne: null }, password: 'longenough' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f) => f.field)).toContain('body.email');
  });

  it('accepts a valid string body and strips unknown keys', async () => {
    const res = await request(buildApp())
      .post('/login')
      .send({ email: 'buyer@example.com', password: 'longenough', role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.body.email).toBe('buyer@example.com');
    // Unknown key was stripped, so a client cannot smuggle extra fields through.
    expect(res.body.body.role).toBeUndefined();
  });
});
