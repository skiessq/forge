/**
 * Helper to parse and split Intro Hook text into lines
 * based on explicit newlines, \n sequences, or wordsPerLine setting.
 */
export function formatHookLines(text: string, wordsPerLine?: number): string[] {
  if (!text) return [];
  // Normalize literal \n string typed by user into actual newlines
  const normalized = text.replace(/\\n/g, '\n').trim();

  // If user explicitly entered newlines (Enter or \n), respect their line breaks!
  if (normalized.includes('\n')) {
    return normalized
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  // If single-line mode requested (-1): never wrap into multiple lines
  if (wordsPerLine === -1) {
    return [normalized];
  }

  // If specific wordsPerLine requested (e.g. 1, 2, 3, 4)
  if (wordsPerLine && wordsPerLine > 0) {
    const words = normalized.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine).join(' '));
    }
    return lines.length ? lines : [normalized];
  }

  // Default: return single string
  return [normalized];
}
