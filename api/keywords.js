import { readFileSync } from 'fs';
import { join } from 'path';

export function loadKeywords() {
  return JSON.parse(readFileSync(join(process.cwd(), 'config', 'keywords.json'), 'utf8'));
}

// First queue entry whose slug is not already in the CMS (draft, live or archived).
export function nextKeyword(queue, existingSlugs) {
  const taken = new Set(existingSlugs);
  return queue.find(entry => !taken.has(entry.slug)) || null;
}
