// Escape HTML special characters to prevent injection
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}

// Sanitize text for safe markdown/MDX embedding: escape HTML special chars and markdown link syntax
export function sanitizeMarkdownText(text: string): string {
  return escapeHtml(text).replace(/[[\]()]/g, (char) => `\\${char}`);
}

// Sanitize text to prevent HTML injection (without markdown-specific escaping)
export function sanitizeText(text: string): string {
  return escapeHtml(text);
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
