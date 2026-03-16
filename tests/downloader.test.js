/**
 * tests/downloader.test.js
 * Unit tests for src/background/downloader.js
 */

import { describe, it, expect, vi } from 'vitest';
import { download } from '../src/background/downloader.js';

// Node doesn't have URL.createObjectURL — shim it for tests
const FAKE_BLOB_URL = 'blob:test/fake-uuid';
global.URL = {
  createObjectURL: vi.fn(() => FAKE_BLOB_URL),
  revokeObjectURL: vi.fn(),
};
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts   = parts;
    this.options = options;
    this.type    = options?.type || '';
  }
};

// ── dataUrl helpers ────────────────────────────────────────────────────────────

// Minimal valid PNG data URL (1x1 transparent px)
const VALID_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=';

// Minimal 1×1 JPEG (valid base64)
const VALID_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARAAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';

// ── download() ─────────────────────────────────────────────────────────────────

describe('download', () => {
  it('calls chrome.downloads.download with the correct filename', async () => {
    await download(VALID_PNG_DATA_URL, 'my-screenshot.png');
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'my-screenshot.png' })
    );
  });

  it('passes saveAs: false when saveLocation is "default"', async () => {
    await download(VALID_PNG_DATA_URL, 'test.png', 'default');
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ saveAs: false })
    );
  });

  it('passes saveAs: true when saveLocation is "prompt"', async () => {
    await download(VALID_PNG_DATA_URL, 'test.png', 'prompt');
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ saveAs: true })
    );
  });

  it('uses a blob URL (not the raw data URL)', async () => {
    await download(VALID_PNG_DATA_URL, 'test.png');
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ url: FAKE_BLOB_URL })
    );
  });

  it('creates a Blob from the data URL', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    await download(VALID_PNG_DATA_URL, 'test.png');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0];
    expect(blob.type).toBe('image/png');
  });

  it('works with a JPEG data URL', async () => {
    await download(VALID_JPEG_DATA_URL, 'photo.jpg', 'default');
    const call = chrome.downloads.download.mock.calls[0][0];
    expect(call.filename).toBe('photo.jpg');
  });

  it('defaults saveLocation to "default" (saveAs: false) when not specified', async () => {
    await download(VALID_PNG_DATA_URL, 'test.png');
    expect(chrome.downloads.download).toHaveBeenCalledWith(
      expect.objectContaining({ saveAs: false })
    );
  });

  it('throws on a null dataUrl', async () => {
    await expect(download(null, 'test.png')).rejects.toThrow('Invalid data URL');
  });

  it('throws on an empty string dataUrl', async () => {
    await expect(download('', 'test.png')).rejects.toThrow('Invalid data URL');
  });

  it('throws on a dataUrl that does not start with "data:"', async () => {
    await expect(download('http://example.com/image.png', 'test.png')).rejects.toThrow('Invalid data URL');
  });

  it('throws when the MIME type cannot be parsed', async () => {
    // Missing the semicolon/MIME portion
    await expect(download('data:bad', 'test.png')).rejects.toThrow('Invalid data URL');
  });
});
