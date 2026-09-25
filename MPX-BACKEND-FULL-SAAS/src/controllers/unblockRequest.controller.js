import * as svc from '../services/unblockRequest.service.js';
import { ownView } from './products.controller.js';
import { moderationView } from './adminProducts.controller.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

/** D6 · seller: ask for a taken-down product to be unblocked. */
export async function request(req, res) {
  const product = await svc.requestUnblock({
    user: req.user,
    id: req.params.id,
    message: req.body.message,
    meta: meta(req),
  });
  res.status(201).json({ product: ownView(product) });
}

/** D6 · staff: decline, with a reason the seller sees. */
export async function reject(req, res) {
  const product = await svc.rejectUnblock({
    id: req.params.id,
    reason: req.body.reason,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ product: moderationView(product) });
}
