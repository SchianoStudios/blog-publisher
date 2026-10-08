const DASHES = /[-\u2010-\u2015\u2212]/;
const UNSOURCED_CLAIMS = /\b(?:we|we've|we're|our|ours|at schiano studios)\b|\b(?:case study|client success story|research shows|studies show)\b|\d+(?:\.\d+)?%|\$\s*\d+|\b20\d{2}\b/i;
const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'for', 'from', 'how', 'in', 'of', 'on', 'the', 'to', 'vs', 'with', 'your', 'you', 'small', 'business', 'guide']);

export function visibleText(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:mdash|ndash|hyphen|minus);|&#(?:8211|8212|45);|&#x(?:2013|2014|2d);/gi, '-')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleTokens(title) {
  return new Set(String(title).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))
    .map(word => word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word));
}

export function isSimilarTitle(title, other) {
  const a = titleTokens(title);
  const b = titleTokens(other);
  if (!a.size || !b.size) return false;
  const common = [...a].filter(token => b.has(token)).length;
  return common / new Set([...a, ...b]).size >= 0.67 ||
    (Math.min(a.size, b.size) >= 3 && common / Math.min(a.size, b.size) >= 0.85);
}

export function validatePost(post, existingTitles = []) {
  const issues = [];
  const fields = ['title', 'cardSnippet', 'metaDescription', 'bodyTop', 'bodyBottom'];
  for (const field of fields) {
    if (typeof post[field] !== 'string' || !post[field].trim()) {
      issues.push(`Missing ${field}`);
      continue;
    }
    const text = visibleText(post[field]);
    if (DASHES.test(text)) issues.push(`Dash or hyphen in ${field}`);
    if (UNSOURCED_CLAIMS.test(text)) issues.push(`Unverified claim or agency story in ${field}`);
  }
  if (existingTitles.some(title => isSimilarTitle(post.title, title))) issues.push('Topic is too similar to an existing post');
  if (post.category === 'Agency Insights' || post.subCategory === 'Client Success Stories' || post.tags?.includes('Case Studies')) {
    issues.push('Agency stories and case studies require editorial evidence');
  }
  if (post.title?.length > 65) issues.push('Title is too long');
  if (post.cardSnippet?.length > 160) issues.push('Card snippet is too long');
  if (post.metaDescription?.length > 160) issues.push('Meta description is too long');
  if (!/<h2\b/i.test(post.bodyTop || '') || !/<p\b/i.test(post.bodyBottom || '')) issues.push('Body is missing headings or paragraphs');
  if (/<\s*(?:script|iframe|style)\b|\bon\w+\s*=/i.test((post.bodyTop || '') + (post.bodyBottom || ''))) issues.push('Unsafe HTML in body');
  return issues;
}

export function validateSeo(post, entry, allowedLinks = []) {
  const issues = [];
  const kw = entry.keyword.toLowerCase();
  const words = kw.split(/\s+/);
  const has = text => { const t = visibleText(text).toLowerCase(); return words.every(w => t.includes(w)); };
  if (!has(post.title)) issues.push(`Title must contain the keyword "${entry.keyword}"`);
  if (!has(post.metaDescription)) issues.push(`Meta description must contain the keyword "${entry.keyword}"`);
  if (!/<h2\b[^>]*>[^<]*/i.test(post.bodyTop || '') || !has((post.bodyTop || '').match(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi)?.join(' ') || '')) {
    issues.push('At least one H2 in the first half must use the keyword');
  }
  const words800 = visibleText((post.bodyTop || '') + ' ' + (post.bodyBottom || '')).split(/\s+/).length;
  if (words800 < 900) issues.push(`Body is ${words800} words; write at least 900`);
  const hrefs = [...((post.bodyTop || '') + (post.bodyBottom || '')).matchAll(/href\s*=\s*"([^"]+)"/gi)].map(m => m[1]);
  const bad = hrefs.filter(h => !allowedLinks.includes(h));
  if (bad.length) issues.push('Links not on the allowed list: ' + bad.join(', '));
  if (!hrefs.includes(entry.cta)) issues.push(`Must link to ${entry.cta}`);
  if (hrefs.filter(h => h.startsWith('/blog-post/')).length < 1) issues.push('Must link to at least one related blog post');
  return issues;
}

export async function fetchExistingItems(collectionId, token) {
  const titles = [];
  const slugs = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items?limit=100&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Could not check existing blog titles: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('Blog title response was invalid');
    titles.push(...data.items.map(item => item.fieldData?.name).filter(Boolean));
    slugs.push(...data.items.map(item => item.fieldData?.slug).filter(Boolean));
    if (data.items.length < 100) return { titles, slugs };
  }
}
