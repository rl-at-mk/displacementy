/**
 * Deliver bytes to the user as a file. The single "save a file" seam: the web
 * build uses an anchor download; a desktop build (Electron) would swap this
 * one function for a native save dialog via IPC. No other module should
 * create download anchors or object URLs for saving.
 */
export const deliverFile = (
  data: Blob | Uint8Array,
  fileName: string,
  mimeType = 'application/octet-stream',
): void => {
  const blob = data instanceof Blob ? data : new Blob([data], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
