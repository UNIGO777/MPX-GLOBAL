import * as svc from '../services/quotation.service.js';

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

export async function createDraft(req, res) {
  const quotation = await svc.createDraft({
    user: req.user,
    conversationId: req.validated.body.conversationId,
    actor: req.user,
    meta: meta(req),
  });
  res.status(201).json({ quotation });
}

export async function update(req, res) {
  const quotation = await svc.updateDraft({
    user: req.user,
    id: req.params.id,
    data: req.validated.body,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ quotation });
}

export async function send(req, res) {
  const quotation = await svc.send({
    user: req.user,
    id: req.params.id,
    bankAccountId: req.validated.body.bankAccountId,
    actor: req.user,
    meta: meta(req),
  });
  res.json({ quotation });
}

export async function draftWithAi(req, res) {
  res.json(
    await svc.draftWithAi({
      user: req.user,
      id: req.params.id,
      target: req.params.target,
      instruction: req.validated.body.instruction,
    }),
  );
}

export async function negotiate(req, res) {
  res.json({
    quotation: await svc.negotiate({
      user: req.user,
      id: req.params.id,
      totalMinor: req.validated.body.totalMinor,
      note: req.validated.body.note,
      actor: req.user,
      meta: meta(req),
    }),
  });
}

export async function requestAcceptCode(req, res) {
  res.json(await svc.requestAcceptCode({ user: req.user, id: req.params.id }));
}

export async function confirmAccept(req, res) {
  res.json({
    quotation: await svc.confirmAccept({
      user: req.user,
      id: req.params.id,
      code: req.validated.body.code,
      actor: req.user,
      meta: meta(req),
    }),
  });
}

export async function decline(req, res) {
  res.json({
    quotation: await svc.decline({
      user: req.user,
      id: req.params.id,
      reason: req.validated.body.reason,
      actor: req.user,
      meta: meta(req),
    }),
  });
}

export async function getOne(req, res) {
  res.json({ quotation: await svc.getOne({ user: req.user, id: req.params.id }) });
}

export async function listForConversation(req, res) {
  res.json({
    quotations: await svc.listForConversation({
      user: req.user,
      conversationId: req.params.conversationId,
    }),
  });
}
