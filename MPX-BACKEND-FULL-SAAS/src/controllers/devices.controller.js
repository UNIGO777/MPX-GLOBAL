import * as svc from '../services/push.service.js';

// The token is a device identifier — it goes in, it never comes back out in a
// response, and it is never logged.

export async function register(req, res) {
  await svc.registerDevice({ user: req.user, ...req.validated.body });
  res.status(201).json({ registered: true });
}

export async function unregister(req, res) {
  await svc.unregisterDevice({ user: req.user, token: req.params.token });
  res.json({ unregistered: true });
}
