import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { permissionRequired } from '../middleware/admin.js';
import { apiError } from '../validate.js';
import { notify } from '../notify.js';
import {
  requestVerification,
  myVerificationStatus,
  listVerificationRequests,
  decideVerification,
} from '../verification.js';
import { ah } from '../async-handler.js';

const router = Router();

// POST /api/verification/request  { type?, note? }
router.post('/verification/request', authRequired, ah(async (req, res) => {
  const { type, note } = req.body || {};
  if (type && !['id', 'selfie'].includes(type)) {
    return apiError(res, 422, 'INVALID_TYPE', 'نوع التوثيق غير صالح', 'type');
  }
  const result = await requestVerification(req.userId, type || 'id', String(note || '').slice(0, 500) || null);
  if (result.duplicate) {
    return apiError(res, 409, 'DUPLICATE_REQUEST', 'لديك طلب توثيق قيد المراجعة بالفعل');
  }
  res.status(201).json({ ok: true, requestId: result.id });
}));

// GET /api/verification/me
router.get('/verification/me', authRequired, ah(async (req, res) => {
  res.json(await myVerificationStatus(req.userId));
}));

// GET /api/admin/verification?status=pending|all
router.get('/admin/verification', permissionRequired('verification', 'review'), ah(async (req, res) => {
  res.json({ requests: await listVerificationRequests(req.query.status || 'pending') });
}));

// POST /api/admin/verification/{id}/decision  { approve: bool, reason? }
router.post('/admin/verification/:id/decision', permissionRequired('verification', 'approve'), ah(async (req, res) => {
  const id = Number(req.params.id);
  const approve = !!(req.body && req.body.approve);
  const result = await decideVerification(id, approve, req.userId, String((req.body && req.body.reason) || '').slice(0, 500) || null);
  if (!result) return apiError(res, 404, 'NOT_PENDING', 'الطلب غير موجود أو سبق مراجعته');
  const u = result.userId;
  await notify(u, 'system', approve ? 'تم توثيق حسابك بنجاح — شارة التوثيق ظاهرة في ملفك' : 'نعتذر، لم تتم الموافقة على طلب توثيق حسابك');
  res.json({ ok: true, result });
}));

export default router;
