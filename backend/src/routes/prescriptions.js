import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { db, toPrescription } from '../db.js';
import { HttpError, requireAuth } from '../auth.js';

const router = Router();
fs.mkdirSync(config.uploadsDir, { recursive: true });

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };
const MAX_BYTES = 6 * 1024 * 1024;

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM prescriptions WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ prescriptions: rows.map(toPrescription) });
});

/** Upload a prescription as base64 (works the same from iOS, Android and web). */
router.post('/', requireAuth, (req, res) => {
  let { fileBase64, mimeType, patientName, doctorName, notes } = req.body || {};
  if (typeof fileBase64 !== 'string' || !fileBase64) throw new HttpError(400, 'Please attach a photo of your prescription');
  const m = fileBase64.match(/^data:([\w/+.-]+);base64,(.*)$/s);
  if (m) {
    mimeType = mimeType || m[1];
    fileBase64 = m[2];
  }
  mimeType = String(mimeType || 'image/jpeg').toLowerCase();
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  const ext = MIME_EXT[mimeType];
  if (!ext) throw new HttpError(400, 'Unsupported file type. Upload a JPG, PNG or PDF.');
  const buf = Buffer.from(fileBase64, 'base64');
  if (buf.length === 0) throw new HttpError(400, 'The uploaded file is empty');
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'File is too large (max 6 MB)');

  const fileName = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, fileName), buf);
  const r = db
    .prepare(
      `INSERT INTO prescriptions (user_id, file_name, mime_type, patient_name, doctor_name, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(req.user.id, fileName, mimeType, patientName || req.user.name, doctorName || null, notes || null);
  res.status(201).json({ prescription: toPrescription(db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(r.lastInsertRowid)) });
});

/** Owner or staff can view the image. */
router.get('/:id/file', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(Number(req.params.id));
  const isStaff = ['admin', 'pharmacist'].includes(req.user.role);
  if (!row || (row.user_id !== req.user.id && !isStaff)) throw new HttpError(404, 'Prescription not found');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.type(row.mime_type).sendFile(path.join(config.uploadsDir, row.file_name));
});

export default router;
