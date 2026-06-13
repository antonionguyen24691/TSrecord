import { fileToBase64 } from './utils/audioUtils';

const DIRECT_UPLOAD_LIMIT_BYTES = 3 * 1024 * 1024;
const CHUNK_SIZE_BYTES = 2 * 1024 * 1024;

type UploadInitResponse = {
  sessionId: string;
  expiresAt: string;
};

const getBackendUrl = () =>
  (import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');

const backendJson = async (path: string, init: RequestInit = {}) => {
  const { backendFetch } = await import('./backendClient');
  const response = await backendFetch(path, init);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Upload API error (${response.status})`);
  }
  return data;
};

const uploadFileInChunks = async (file: File, deviceId: string): Promise<string> => {
  const init = await backendJson('/api/v2/uploads/init', {
    method: 'POST',
    body: JSON.stringify({
      deviceKey: deviceId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalBytes: file.size,
    }),
  }) as UploadInitResponse;

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
  let offset = 0;
  let chunkIndex = 0;

  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE_BYTES);
    const chunkBase64 = await fileToBase64(new File([slice], file.name, { type: file.type }));
    const isLast = chunkIndex === totalChunks - 1;

    await backendJson(`/api/v2/uploads/${init.sessionId}/chunk`, {
      method: 'POST',
      body: JSON.stringify({
        deviceKey: deviceId,
        chunkIndex,
        chunkBase64,
        isLast,
      }),
    });

    offset += CHUNK_SIZE_BYTES;
    chunkIndex += 1;
  }

  return init.sessionId;
};

export const buildProxyTranscribeBody = async (
  file: File,
  deviceId: string,
  basePayload: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  if (file.size <= DIRECT_UPLOAD_LIMIT_BYTES) {
    return {
      ...basePayload,
      deviceId,
      fileBase64: await fileToBase64(file),
      fileName: file.name,
      fileType: file.type || 'audio/wav',
    };
  }

  const uploadSessionId = await uploadFileInChunks(file, deviceId);
  return {
    ...basePayload,
    deviceId,
    uploadSessionId,
    fileName: file.name,
    fileType: file.type || 'audio/wav',
  };
};
