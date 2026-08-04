import { Router } from 'express';
import multer from 'multer';
import { db } from '../db.js';
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
  markProfilePhotoDone,
  markSelfieDone,
  deletePhoto,
  getMaxSize,
  isAllowedFile,
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

// POST /api/profile/photo — upload profile photo
router.post('/profile/photo', authRequired, upload.single('photo'), (req, res) => {
  const file = req.file;
  if (!file) return apiError(res, 422, 'INVALID_FILE', 'ملف الصورة غير صالح أو مفقود', 'photo');
  const result = storePhoto(req.userId, 'profile', file);
  if (!result.ok) return apiError(res, 422, result.code, result.detail || 'فشل رفع الصورة', 'photo', result);
  markProfilePhotoDone(req.userId);
  const trustLevel = updateUserTrustLevel(req.userId);
  publish('ProfilePhotoUploaded', { photoId: result.id }, 'api', { userId: req.userId, entityType: 'photo', entityId: String(result.id) });
  res.status(201).json({ ok: true, photoId: result.id, url: photoUrl(result), trustLevel });
});

// GET /api/profile/photos — list my active photos
router.get('/profile/photos', authRequired, (req, res) => {
  const profile = getUserActivePhoto(req.userId, 'profile');
  const selfie = getUserActivePhoto(req.userId, 'selfie');
  res.json({
    profile: profile ? { id: profile.id, url: photoUrl(profile) } : null,
    selfie: selfie ? { id: selfie.id, url: photoUrl(selfie) } : null,
  });
});

// POST /api/profile/selfie — upload selfie for verification
router.post('/profile/selfie', authRequired, upload.single('photo'), (req, res) => {
  const file = req.file;
  if (!file) return apiError(res, 422, 'INVALID_FILE', 'ملف الصورة غير صالح أو مفقود', 'photo');
  const result = storePhoto(req.userId, 'selfie', file);
  if (!result.ok) return apiError(res, 422, result.code, result.detail || 'فشل رفع السيلفي', 'photo', result);
  markSelfieDone(req.userId);
  const trustLevel = updateUserTrustLevel(req.userId);
  publish('SelfieVerified', { photoId: result.id }, 'api', { userId: req.userId, entityType: 'photo', entityId: String(result.id) });
  res.status(201).json({ ok: true, photoId: result.id, url: photoUrl(result), trustLevel });
});

// GET /api/photos/:filename — serve photo with platform-only access
router.get('/photos/:filename', authRequired, (req, res) => {
  const filename = req.params.filename;
  const photo = getPhotoByFilename(filename);
  if (!photo) {
    return apiError(res, 404, 'PHOTO_NOT_FOUND', 'الصورة غير موجودة');
  }
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  if (!canViewPhoto(photo, req.userId, user?.role)) {
    return apiError(res, 403, 'PHOTO_FORBIDDEN', 'لا تملك صلاحية مشاهدة هذه الصورة');
  }
  const data = readPhotoFile(photo.filename);
  if (!data) return apiError(res, 404, 'PHOTO_NOT_FOUND', 'ملف الصورة غير موجود');
  res.setHeader('Content-Type', photo.mime_type);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(data);
});

// DELETE /api/profile/photo — remove current profile photo
router.delete('/profile/photo', authRequired, (req, res) => {
  deletePhoto(req.userId, 'profile');
  res.json({ ok: true });
});

// DELETE /api/profile/selfie — remove current selfie
router.delete('/profile/selfie', authRequired, (req, res) => {
  deletePhoto(req.userId, 'selfie');
  res.json({ ok: true });
});

export default router;
