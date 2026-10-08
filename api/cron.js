// api/cron.js
// Vercel Cron Job: drafts the next keyword from config/keywords.json.
// Runs Tuesday and Friday. Posts are created as drafts for review, never auto published.
// Protected by CRON_SECRET env variable.

import { fetchExistingItems } from './content-quality.js';
import { loadKeywords, nextKeyword } from './keywords.js';

const COLLECTION_ID = '660d58957af23fb39d811a83';

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { queue } = loadKeywords();
    const { slugs } = await fetchExistingItems(COLLECTION_ID, process.env.WEBFLOW_API_TOKEN);
    const entry = nextKeyword(queue, slugs);
    if (!entry) {
      console.log('Keyword queue is empty. Add rows to config/keywords.json.');
      return res.status(200).json({ success: true, skipped: 'queue empty' });
    }
    console.log(`Drafting keyword: ${entry.keyword}`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blog-publisher-rose.vercel.app';
    const blogRes = await fetch(`${appUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({ slug: entry.slug })
    });
    if (!blogRes.ok) throw new Error(`Blog generation failed: ${await blogRes.text()}`);

    const result = await blogRes.json();
    console.log(`Draft created: ${result.title}`);
    return res.status(200).json({ success: true, keyword: entry.keyword, title: result.title, slug: result.slug, draftedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Cron job failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
