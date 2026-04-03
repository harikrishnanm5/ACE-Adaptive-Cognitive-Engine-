/**
 * Utility to strip markdown formatting from AI-generated text.
 * Ensures "Pure Text" for clear UI display and voice synthesis.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";
  
  return text
    .replace(/\*\*/g, '')          // Bold
    .replace(/\*/g, '')           // Bullets/Italic
    .replace(/#/g, '')            // Headers
    .replace(/__/g, '')           // Underscore bold
    .replace(/_/g, '')            // Underscore italic
    .replace(/\[|\]|\(|\)/g, '')  // Brackets/Links
    .replace(/`|~/g, '')          // Code/Strikethrough
    .trim();
}

/**
 * Creates a clean title from a studio note content.
 */
export function getSafeTitle(content: string): string {
  const firstLine = content.split('\n')[0];
  return stripMarkdown(firstLine.replace(/^Title: |Generated |:/gi, ''));
}
/**
 * Truncates source context to fit within standard local LLM context windows (e.g., 4096 tokens).
 * 12,000 characters is a safe limit that leaves ~1,000 tokens for the prompt and generated response.
 */
export function truncateContext(text: string, maxChars = 12000): string {
  if (!text || text.length <= maxChars) return text;
  
  return text.substring(0, maxChars) + "\n\n[... Context Truncated for 4k Token Performance ...]";
}
