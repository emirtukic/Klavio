// Detects the real image type from file bytes (magic numbers) instead of
// trusting the client-supplied extension/Content-Type, which can be spoofed
// to get an arbitrary file served from the public R2 bucket with a
// browser-renderable Content-Type (stored XSS vector).
const SIGNATURES = [
  { mime: 'image/png',  ext: '.png',  check: b => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { mime: 'image/jpeg', ext: '.jpg',  check: b => b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { mime: 'image/gif',  ext: '.gif',  check: b => b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  { mime: 'image/webp', ext: '.webp', check: b => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

// Returns { mime, ext } for a recognized image, or null if the buffer isn't one.
function detectImageType(buffer) {
  const sig = SIGNATURES.find(s => s.check(buffer));
  return sig ? { mime: sig.mime, ext: sig.ext } : null;
}

module.exports = { detectImageType };
