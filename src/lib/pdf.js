/**
 * pdf.js — Minimal single-page PDF generator for screenshot export
 *
 * Embeds a JPEG (converted from any image format) into a PDF document.
 * No external dependencies — constructs a valid PDF-1.4 binary directly.
 */

/**
 * Converts an image data URL (any format) to a PDF data URL.
 *
 * @param {string} dataUrl  - Source image (PNG / JPEG / WebP data URL)
 * @param {number} quality  - JPEG quality 1–100 used when embedding
 * @returns {Promise<string>} data:application/pdf;base64,…
 */
export async function imageToPdfDataUrl(dataUrl, quality = 90) {
  const { jpegDataUrl, width, height } = await toJpeg(dataUrl, quality);
  const [, b64] = jpegDataUrl.split(',');
  const imgBytes = base64ToBytes(b64);
  const pdfBytes = buildPdf(imgBytes, width, height);
  return 'data:application/pdf;base64,' + bytesToBase64(pdfBytes);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function toJpeg(dataUrl, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve({
        jpegDataUrl: canvas.toDataURL('image/jpeg', quality / 100),
        width:  img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = dataUrl;
  });
}

function base64ToBytes(b64) {
  const str   = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let str = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    str += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(str);
}

function concat(arrays) {
  const total  = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { result.set(a, pos); pos += a.length; }
  return result;
}

// ── PDF structure ─────────────────────────────────────────────────────────────

function buildPdf(imgBytes, w, h) {
  const enc = new TextEncoder();

  // Content stream: scale image to fill the page
  const contentBytes = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Img Do Q`);

  const obj1 = enc.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const obj2 = enc.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  const obj3 = enc.encode(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}]` +
    ` /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n`
  );
  const obj4 = concat([
    enc.encode(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
    contentBytes,
    enc.encode('\nendstream\nendobj\n'),
  ]);
  const obj5 = concat([
    enc.encode(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h}` +
      ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode` +
      ` /Length ${imgBytes.length} >>\nstream\n`
    ),
    imgBytes,
    enc.encode('\nendstream\nendobj\n'),
  ]);

  // PDF header — high-byte comment marks the file as binary
  const header = enc.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Compute byte offsets for the xref table
  const parts = [obj1, obj2, obj3, obj4, obj5];
  let offset = header.length;
  const offsets = parts.map(p => { const o = offset; offset += p.length; return o; });
  const xrefOffset = offset;

  // xref entries must be exactly 20 bytes each (10-digit offset + " " + 5-digit gen + " n \n")
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (const o of offsets) {
    xref += String(o).padStart(10, '0') + ' 00000 n \n';
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return concat([header, ...parts, enc.encode(xref)]);
}
