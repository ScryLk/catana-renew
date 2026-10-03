/** Shared policy: raster data only, no SVG, active protocols, or protocol-relative URLs. */
export function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim() || /[\u0000-\u001f\\]/.test(url)) return false;
  return /^(https?:\/\/[^/\s]+|\/(?!\/)|blob:|data:image\/(png|jpeg|webp|gif);base64,)/i.test(url.trim());
}
