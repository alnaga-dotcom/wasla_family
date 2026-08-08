import { Router } from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { ah } from '../async-handler.js';
import { authRequired } from '../middleware/auth.js';
import { apiError } from '../validate.js';
import { updateUserTrustLevel } from '../trust.js';
import {
  storePhoto,
  getPhotoByFilename,
  readPhotoFile,
  canViewPhoto,
  photoUrl,
  getUserActivePhoto,
  getLatestPhoto,
  getUserPrivatePhotos,
  approvePhoto,
  rejectPhoto,
  deletePhoto,
  deletePrivatePhoto,
  getMaxSize,
  isAllowedFile,
  evaluateImage,
  markSelfieDone,
} from '../uploads.js';
import { publish } from '../events.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getMaxSize() },
  fileFilter: (req, file, cb) => {
    cb(null, isAllowedFile(file.mimetype));
  },
});

// POST /api/profile/photo — upload profile photo (goes to moderation review)
router.post('/profile/photo', authRequired, upload.single('photo'), ah(async (req, res) => {
  const file = req.file;
  if (!file) return apiError(res, 422, 'INVALID_FILE', 'ملف الصورة غير صالح أو مفقود', 'photo');
  const result = await storePhoto(req.userId, 'profile', file);
  if (!result.ok) return apiError(res, 422, result.code, result.detail || 'فشل رفع الصورة', 'photo', result);

  // Future AI seam: auto-approve/reject obvious cases; today the stub always sends to the human queue.
  const verdict = await evaluateImage(file);
  if (verdict.verdict === 'approve') {
    await approvePhoto(result.id, null);
    await publish('ProfilePhotoApproved', { photoId: result.id }, 'api', { userId: req.userId, entityType: 'photo', entityId: String(result.id) });
    return res.status(201).json({ ok: true, photoId: result.id, status: 'approved', url: photoUrl(result) });
  }
  if (verdict.verdict === 'reject') {
    await rejectPhoto(result.id, null, verdict.reasons.join(', '));
    return apiError(res, 422, 'PHOTO_REJECTED', 'الصورة لا تستوفي شروط النشر — جرّب صورة أخرى', 'photo');
  }

  await publish('ProfilePhotoUploaded', { photoId: result.id }, 'api', { userId: req.userId, entityType: 'photo', entityId: String(result.id) });
  res.status(201).json({ ok: true, photoId: result.id, status: 'pending', url: photoUrl(result) });
}));

// POST /api/profile/private — upload a private photo (match-only gallery, max 6)
router.post('/profile/private', authRequired, upload.single('photo'), ah(async (req, res) => {
  const file = req.file;
  if (!file) return apiError(res, 422, 'INVALID_FILE', 'ملف الصورة غير صالح أو مفقود', 'photo');
  const result = await storePhoto(req.userId, 'private', file);
  if (!result.ok) return apiError(res, 422, result.code, result.detail || 'فشل رفع الصورة', 'photo', result);
  await publish('PrivatePhotoUploaded', { photoId: result.id }, 'api', { userId: req.userId, entityType: 'photo', entityId: String(result.id) });
  res.status(201).json({ ok: true, photoId: result.id, url: photoUrl(result) });
}));

// DELETE /api/profile/private/:id — remove one private photo
router.delete('/profile/private/:id', authRequired, ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return apiError(res, 422, 'INVALID_ID', 'معرّف صورة غير صالح');
  const result = await deletePrivatePhoto(req.userId, id);
  if (!result.ok) return apiError(res, 404, 'PHOTO_NOT_FOUND', 'الصورة غير موجودة');
  res.json({ ok: true });
}));

// GET /api/profile/photos — list my photos with review state
router.get('/profile/photos', authRequired, ah(async (req, res) => {
  const profile = await getLatestPhoto(req.userId, 'profile');
  const selfie = await getUserActivePhoto(req.userId, 'selfie');
  const privates = await getUserPrivatePhotos(req.userId);
  res.json({
    profile: profile ? { id: profile.id, url: photoUrl(profile), reviewStatus: profile.review_status } : null,
    selfie: selfie ? { id: selfie.id, url: photoUrl(selfie) } : null,
    private: privates.map((p) => ({ id: p.id, url: photoUrl(p) })),
  });
}));

// POST /api/profile/selfie — upload selfie for verification
router.post('/profile/selfie', authRequired, upload.single('photo'), ah(async (req, res) => {
  const file = req.file;
  if (!file) return apiError(res, 422, 'INVALID_FILE', 'ملف الصورة غير صالح أو مفقود', 'photo');
  const result = await storePhoto(req.userId, 'selfie', file);
  if (!result.ok) return apiError(res, 422, result.code, result.detail || 'فشل رفع السيلفي', 'photo', result);
  await markSelfieDone(req.userId);
  const trustLevel = await updateUserTrustLevel(req.userId);
  await publish('SelfieVerified', { photoId: result.id }, 'api', { userId: req.userId, entityType: 'photo', entityId: String(result.id) });
  res.status(201).json({ ok: true, photoId: result.id, url: photoUrl(result), trustLevel });
}));

// GET /api/photos/:filename — serve photo with platform-only access
router.get('/photos/:filename', authRequired, ah(async (req, res) => {
  const filename = req.params.filename;
  const photo = await getPhotoByFilename(filename);
  if (!photo) {
    return apiError(res, 404, 'PHOTO_NOT_FOUND', 'الصورة غير موجودة');
  }
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  if (!await canViewPhoto(photo, req.userId, user?.role)) {
    return apiError(res, 403, 'PHOTO_FORBIDDEN', 'لا تملك صلاحية مشاهدة هذه الصورة');
  }
  const data = readPhotoFile(photo.filename);
  if (!data) return apiError(res, 404, 'PHOTO_NOT_FOUND', 'ملف الصورة غير موجود');
  res.setHeader('Content-Type', photo.mime_type);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(data);
}));

// DELETE /api/profile/photo — remove current profile photo
router.delete('/profile/photo', authRequired, ah(async (req, res) => {
  await deletePhoto(req.userId, 'profile');
  res.json({ ok: true });
}));

// DELETE /api/profile/selfie — remove current selfie
router.delete('/profile/selfie', authRequired, ah(async (req, res) => {
  await deletePhoto(req.userId, 'selfie');
  res.json({ ok: true });
}));

export default router;
