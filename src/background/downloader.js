/**
 * downloader.js — File download wrapper
 *
 * Converts a data URL to a blob URL (required by chrome.downloads)
 * and triggers a download with the given filename.
 */

/**
 * @param {string} dataUrl      - Image data URL
 * @param {string} filename     - e.g. "example-com.png"
 * @param {string} saveLocation - 'prompt' | 'default'
 */
export async function download(dataUrl, filename, saveLocation = 'default') {
  const blobUrl = await dataUrlToBlobUrl(dataUrl);

  await chrome.downloads.download({
    url:       blobUrl,
    filename,
    saveAs:    saveLocation === 'prompt',
  });

  // Blob URLs should be revoked after download starts to free memory.
  // Chrome downloads are async, so a short delay is enough.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

function dataUrlToBlobUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL: expected a data: URI string.');
  }
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  if (!mimeMatch) throw new Error('Invalid data URL: could not extract MIME type.');
  const mime  = mimeMatch[1];
  const bytes = atob(data);
  const arr   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob  = new Blob([arr], { type: mime });
  return URL.createObjectURL(blob);
}
