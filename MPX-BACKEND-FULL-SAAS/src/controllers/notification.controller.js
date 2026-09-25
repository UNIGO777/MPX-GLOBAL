import * as svc from '../services/notification.service.js';

// Every call reads the caller's id from the verified token — never from the
// request — so a notification can only ever be listed or marked by its owner.

export async function list(req, res) {
  const { before, unread } = req.validated.query;
  res.json(await svc.listMine({ userId: req.user.userId, before, unreadOnly: unread === '1' }));
}

export async function unreadCount(req, res) {
  res.json({ unread: await svc.unreadCount({ userId: req.user.userId }) });
}

export async function markRead(req, res) {
  res.json(await svc.markRead({ userId: req.user.userId, id: req.validated.params.id }));
}

export async function markAllRead(req, res) {
  res.json(await svc.markAllRead({ userId: req.user.userId }));
}
