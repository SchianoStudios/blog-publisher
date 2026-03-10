export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, autoPublish } = req.body;
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  const SITE_ID = '65f84f5590354c6d7dcf4e39';
  const COLLECTION_ID = '660d58957af23fb39d811a83';

  try {
    // Step 1: Generate blog content via Claude
    console.log('✍️ Generating blog content for:', topic);
    const contentRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are a web design and digital marketing expert writing for Schiano Studios, a NYC-based web design agency. Write a comprehensive, SEO-optimized blog post about: "${topic}"

Return ONLY a valid JSON object with these exact fields:
{
  "title": "compelling SEO title (max 60 chars)",
  "slug": "url-friendly-slug-with-dashes",
  "cardSnippet": "2-sentence preview for blog card (max 150 chars)",
  "metaDescription": "SEO meta description (max 155 chars)",
  "readTime": "X min read",
  "bodyTop": "<h2>Section Title</h2><p>Content...</p> (HTML, ~600 words, first half of post)",
  "bodyBottom": "<h2>Section Title</h2><p>Content...</p> (HTML, ~600 words, second half of post)",
  "imageQuery": "specific search query for a relevant Unsplash photo",
  "midImageQuery": "different specific search query for a second Unsplash photo"
}

Write in a professional but approachable tone. Focus on practical value for small business owners and entrepreneurs. Include relevant web design, SEO, and digital marketing insights where appropriate.`
        }]
      })
    });

    const contentData = await contentRes.json();
    const rawText = contentData.content[0].text;
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const post = JSON.parse(cleaned);
    console.log('✅ Content generated:', post.title);

    // Step 2: Upload main image
    console.log('🖼️ Uploading main image...');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blog-publisher-rose.vercel.app';
    const mainImgRes = await fetch(`${appUrl}/api/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageQuery: post.imageQuery,
        siteId: SITE_ID,
        fileName: `blog-main-${post.slug}-${Date.now()}.jpg`,
        keyword: topic
      })
    });
    const mainImg = await mainImgRes.json();
    if (!mainImg.success) throw new Error('Main image upload failed: ' + mainImg.error);
    console.log('✅ Main image uploaded:', mainImg.assetId);

    // Step 3: Upload mid-blog image
    console.log('🖼️ Uploading mid-blog image...');
    const midImgRes = await fetch(`${appUrl}/api/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageQuery: post.midImageQuery,
        siteId: SITE_ID,
        fileName: `blog-mid-${post.slug}-${Date.now()}.jpg`,
        keyword: topic
      })
    });
    const midImg = await midImgRes.json();
    if (!midImg.success) throw new Error('Mid image upload failed: ' + midImg.error);
    console.log('✅ Mid image uploaded:', midImg.assetId);

    // Step 4: Create CMS item
    console.log('📝 Creating CMS item...');
    const now = new Date().toISOString();
    const createRes = await fetch(`https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
      },
      body: JSON.stringify({
        isArchived: false,
        isDraft: false,
        fieldData: {
          name: post.title,
          slug: post.slug,
          'post-body-top': post.bodyTop,
          'post-body-bottom': post.bodyBottom,
          'card-snippet': post.cardSnippet,
          'page-meta-description': post.metaDescription,
          'read-time': post.readTime,
          'date': now,
          'main-image': { fileId: mainImg.assetId, url: mainImg.hostedUrl, alt: mainImg.altText },
          'main-image---alt-text': mainImg.altText,
          'mid-blog-image': { fileId: midImg.assetId, url: midImg.hostedUrl, alt: midImg.altText },
          'mid-blog-image-alt-text': midImg.altText,
        }
      })
    });

    const created = await createRes.json();
    if (!created.id) throw new Error('CMS create failed: ' + JSON.stringify(created));
    console.log('✅ CMS item created:', created.id);

    // Step 5: Publish the item
    if (autoPublish) {
      console.log('🚀 Publishing CMS item...');
      const publishRes = await fetch(`https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
        },
        body: JSON.stringify({ itemIds: [created.id] })
      });
      const published = await publishRes.json();
      console.log('✅ Published:', JSON.stringify(published));
    }

    res.status(200).json({
      success: true,
      title: post.title,
      slug: post.slug,
      itemId: created.id,
      published: !!autoPublish
    });

  } catch (err) {
    console.error('❌ Generate failed:', err.message);
    res.status(500).json({ error: err.message });
  }
}
