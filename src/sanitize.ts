// Sanitize text to prevent HTML/markdown injection from untrusted sources.
// Escapes HTML special characters: & < > " '
export function sanitizeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Sanitize text for safe markdown/MDX embedding: escape HTML special chars and markdown link syntax
export function sanitizeMarkdownText(text: string): string {
  return sanitizeHtml(text).replace(/[[\]()]/g, (char) => `\\${char}`);
}

// Sanitize URL for safe markdown link embedding: only allow http/https protocols
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url.replace(/[()]/g, (char) => encodeURIComponent(char));
    }
    return '';
  } catch {
    return '';
  }
}

// Sanitize IDs to prevent path traversal from untrusted sources
export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, '-');
}
