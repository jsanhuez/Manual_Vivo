import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.use({ gfm: true, breaks: false });

// El contenido lo escriben editores, por eso se sanitiza siempre antes de insertarlo como HTML
export function renderMarkdown(source: string): string {
  const html = marked.parse(source ?? '', { async: false });
  return DOMPurify.sanitize(html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// La API marca las coincidencias con ⟦ y ⟧ y se convierten en <mark> después de escapar el texto
export function highlightSnippet(snippet: string): string {
  const plain = snippet
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return escapeHtml(plain).replace(/⟦/g, '<mark>').replace(/⟧/g, '</mark>');
}
