import * as svc from '../services/bankAccount.service.js';

// Same local helper every other controller here uses — there is no shared
// module for it, and inventing one for this file would be the odd one out.
function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function list(req, res) {
  res.json({ bankAccounts: await svc.listBankAccounts({ user: req.user }) });
}

export async function create(req, res) {
  const bankAccount = await svc.createBankAccount({
    user: req.user,
    data: req.validated.body,
    actor: req.user,
    meta: meta(req),
  });
  res.status(201).json({ bankAccount });
}

export async function update(req, res) {
  const bankAccount = await svc.updateBankAccount({
    user: req.user,
    id: req.params.id,
    data: req.validated.body,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ bankAccount });
}

export async function remove(req, res) {
  res.json(
    await svc.removeBankAccount({
      user: req.user,
      id: req.params.id,
      actor: req.user,
      meta: meta(req),
    }),
  );
}

export async function confirm(req, res) {
  const bankAccount = await svc.confirmBankAccount({
    user: req.user,
    id: req.params.id,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ bankAccount });
}
