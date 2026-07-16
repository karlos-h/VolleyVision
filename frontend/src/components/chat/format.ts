/** "342 KB", "2.4 MB" — attachment sizes at chip scale. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Client-side mirrors of the backend allow-lists (chatStorage.service.ts) so
// bad files are rejected before any bytes leave the browser. The server
// re-validates everything.
export const CHAT_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const CHAT_FILE_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
export const CHAT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const CHAT_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const CHAT_MAX_ATTACHMENTS = 10;

export const CHAT_ACCEPT_ATTR = [...CHAT_IMAGE_MIME, ...CHAT_FILE_MIME].join(',');

/** Null when acceptable, otherwise a user-facing rejection message. */
export function rejectFileReason(file: File): string | null {
  const isImage = CHAT_IMAGE_MIME.has(file.type);
  const isFile = CHAT_FILE_MIME.has(file.type);
  if (!isImage && !isFile) {
    return `"${file.name}" isn't a supported type. Use images, PDF, office documents, plain text, or CSV.`;
  }
  const cap = isImage ? CHAT_MAX_IMAGE_BYTES : CHAT_MAX_FILE_BYTES;
  if (file.size > cap) {
    return `"${file.name}" is too large (max ${Math.round(cap / (1024 * 1024))} MB for ${isImage ? 'images' : 'files'}).`;
  }
  return null;
}
