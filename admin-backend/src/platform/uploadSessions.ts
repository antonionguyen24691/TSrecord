import crypto from 'crypto';
import { one, query, withTransaction } from './database.js';

const DEFAULT_MAX_BYTES = Number(process.env.UPLOAD_SESSION_MAX_BYTES || 25 * 1024 * 1024);
const SESSION_TTL_MINUTES = Number(process.env.UPLOAD_SESSION_TTL_MINUTES || 30);

export const createUploadSession = async (input: {
  deviceKey: string;
  fileName: string;
  mimeType: string;
  totalBytes: number;
}) => {
  if (input.totalBytes < 1 || input.totalBytes > DEFAULT_MAX_BYTES) {
    throw new Error(`Kích thước file phải từ 1 byte đến ${DEFAULT_MAX_BYTES} bytes.`);
  }

  const session = await one<{ id: string; expires_at: string }>(
    `INSERT INTO upload_sessions_v2
       (device_key, file_name, mime_type, expected_bytes, max_bytes, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 minute'))
     RETURNING id, expires_at`,
    [
      input.deviceKey,
      input.fileName,
      input.mimeType,
      input.totalBytes,
      DEFAULT_MAX_BYTES,
      SESSION_TTL_MINUTES,
    ]
  );
  if (!session) throw new Error('Không thể tạo phiên upload.');
  return session;
};

export const appendUploadChunk = async (input: {
  sessionId: string;
  deviceKey: string;
  chunkIndex: number;
  chunkBase64: string;
  isLast: boolean;
}) => withTransaction(async (client) => {
  const sessionResult = await client.query<{
    id: string;
    device_key: string;
    expected_bytes: string;
    received_bytes: string;
    payload: Buffer | null;
    expires_at: string;
    status: string;
  }>(
    `SELECT id, device_key, expected_bytes, received_bytes, payload, expires_at, status
     FROM upload_sessions_v2
     WHERE id = $1
     FOR UPDATE`,
    [input.sessionId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new Error('Phiên upload không tồn tại.');
  if (session.device_key !== input.deviceKey) throw new Error('Phiên upload không thuộc thiết bị này.');
  if (session.status !== 'open') throw new Error('Phiên upload đã đóng.');
  if (new Date(session.expires_at) < new Date()) throw new Error('Phiên upload đã hết hạn.');

  const chunk = Buffer.from(input.chunkBase64, 'base64');
  if (chunk.length < 1) throw new Error('Chunk rỗng.');

  const nextSize = Number(session.received_bytes) + chunk.length;
  if (nextSize > Number(session.expected_bytes) + 1024) {
    throw new Error('Tổng dung lượng upload vượt kích thước khai báo.');
  }

  const merged = Buffer.concat([
    session.payload ? Buffer.from(session.payload) : Buffer.alloc(0),
    chunk,
  ]);

  const nextStatus = input.isLast ? 'ready' : 'open';
  await client.query(
    `UPDATE upload_sessions_v2
     SET payload = $2,
         received_bytes = $3,
         chunk_count = chunk_count + 1,
         status = $4,
         updated_at = now()
     WHERE id = $1`,
    [session.id, merged, nextSize, nextStatus]
  );

  return {
    sessionId: session.id,
    receivedBytes: nextSize,
    expectedBytes: Number(session.expected_bytes),
    status: nextStatus,
  };
});

export const consumeUploadSession = async (sessionId: string, deviceKey: string) => {
  const session = await one<{
    id: string;
    device_key: string;
    file_name: string;
    mime_type: string;
    payload: Buffer | null;
    received_bytes: string;
    expected_bytes: string;
    status: string;
  }>(
    `SELECT id, device_key, file_name, mime_type, payload, received_bytes, expected_bytes, status
     FROM upload_sessions_v2
     WHERE id = $1`,
    [sessionId]
  );

  if (!session) throw new Error('Phiên upload không tồn tại.');
  if (session.device_key !== deviceKey) throw new Error('Phiên upload không thuộc thiết bị này.');
  if (session.status !== 'ready') throw new Error('Phiên upload chưa hoàn tất.');
  if (!session.payload || session.payload.length < 1) throw new Error('Phiên upload không có dữ liệu.');

  await query(
    `UPDATE upload_sessions_v2
     SET status = 'consumed', consumed_at = now(), updated_at = now()
     WHERE id = $1`,
    [session.id]
  );

  return {
    buffer: Buffer.from(session.payload),
    fileName: session.file_name,
    mimeType: session.mime_type,
    sizeBytes: Number(session.received_bytes),
  };
};

export const purgeExpiredUploadSessions = async () => {
  const rows = await query(
    `DELETE FROM upload_sessions_v2
     WHERE expires_at < now() AND status <> 'consumed'
     RETURNING id`
  );
  return rows.length;
};

export const newUploadSessionId = () => crypto.randomUUID();
