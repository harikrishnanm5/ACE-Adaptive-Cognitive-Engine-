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
    .replace(/[:]/g, '')          // Colons (which can sometimes be weird in TTS)
    .trim();
}

/**
 * Creates a clean title from a studio note content.
 */
export function getSafeTitle(content: string): string {
  const firstLine = content.split('\n')[0];
  return stripMarkdown(firstLine.replace(/^Title: |Generated |:/gi, ''));
}
