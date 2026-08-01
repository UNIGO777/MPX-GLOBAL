import * as svc from '../services/inquiry.service.js';

// M4-35 (OLX-style): creating an enquiry drops the buyer straight into the
// thread — there is no enquiry inbox. So the response carries the conversation
// id the client navigates to, not a confirmation page.

function meta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'], requestId: req.id };
}

// Curated. Full projections land with the thread reads (M4-C); an enquiry's own
// creator may see their own structured ask back.
function createdView({ inquiry, conversation }) {
  return {
    conversationId: String(conversation._id),
    inquiry: {
      id: String(inquiry._id),
      fields: inquiry.fields ?? {},
      note: inquiry.note ?? null,
      createdAt: inquiry.createdAt,
    },
  };
}

export async function create(req, res) {
  const result = await svc.createInquiry({ user: req.user, ...req.validated.body, meta: meta(req) });
  // M4-5: a second enquiry never opens a second thread — it returns the existing
  // one. 200 (not 201) says plainly that nothing new was created.
  res.status(result.created ? 201 : 200).json(createdView(result));
}
