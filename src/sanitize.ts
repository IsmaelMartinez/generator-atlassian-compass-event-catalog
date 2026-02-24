// Sanitize text to prevent HTML/markdown injection from untrusted sources.
// Escapes HTML special characters: & < > " '
export function sanitizeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Sanitize IDs to prevent path traversal from untrusted sources
export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, '-');
}
