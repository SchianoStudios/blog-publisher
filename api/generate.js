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

  const CATEGORIES = {
    'Web Design': '660d4f378170818096c5d0d5',
    'SEO & Analytics': '660d4f44be784480d33e97b1',
    'Digital Marketing': '660d4f4ed8dd1c0f27cf15ad',
    'Development & Tech': '660d4f6cadb8f71cead625ad',
    'Agency Insights': '660d4f7f6f3240c5eb914eee',
    'Resources & Tools': '660d4f8a6f3240c5eb915b47',
  };

  const SUB_CATEGORIES = {
    'Trends & Inspirations': { id: '660d5277c009a8aee4a2a884' },
    'UX/UI Design Tips': { id: '660d52675ba11bc9b9c35922' },
    'Website Makeovers': { id: '660d523f87e5053868b85b0a' },
    'Accessibility & Inclusivity': { id: '660d52327658000e5d78a226' },
    'SEO Strategies': { id: '660d521df00263e046be0973' },
    'Google Analytics Tips': { id: '660d521081948ad05838aa01' },
    'Keyword Research': { id: '660d52030024e13e78861b50' },
    'Local SEO': { id: '660d51f7e4620a4235efb1fc' },
    'Content Marketing': { id: '660d51e72dfab9a395f674c6' },
    'Social Media Strategies': { id: '660d51db830081d9511b80b3' },
    'Email Marketing': { id: '660d51cda277ef4e5004ce3a' },
    'PPC & Ad Campaigns': { id: '660d51bf7667e5320c824d56' },
    'Frontend Development': { id: '660d50ccb38ddac40b94e26d' },
    'Backend Development': { id: '660d50c09dbb18c2088ef327' },
    'Website Security': { id: '660d50af0d06f4436f1b2af0' },
    'Emerging Technologies': { id: '660d50a3ea829d3cc3d277a8' },
    'Behind the Scenes': { id: '660d5094fe71c27ac401cd65' },
    'Client Success Stories': { id: '660d508486ab1c9e4943718a' },
    'Agency News': { id: '660d507130b508b5133b5769' },
    'Tutorials & Guides': { id: '660d5033adb8f71cead6e2fc' },
    'Productivity Tools': { id: '660d502a0d06f4436f1b2af0' },
    'Marketing Tools': { id: '660d5020eff61f9acee0ed14' },
    'Design Tools': { id: '660d501704688ce29200415a' },
  };

  const TAGS = {
    'How-To Guides': '660d57eff0fad7dc2414658b',
    'Best Practices': '660d57ef5bd8f3eb1d6959c6',
    'Industry News': '660d57eff421703bb5d25736',
    'Case Studies': '660d57ef253a526ba1ce0646',
    'Design Inspiration': '660d57ef5bcf202b3a114314',
    'SEO Tools': '660d57ec8eb0c3cdd4c1ebd6',
    'Technical SEO': '660d57ec91caba866d4d38d9',
    'On-Page SEO': '660d57ec756c4456df958fd2',
    'Off-Page SEO': '660d57ec8f1e22f9ee24397c',
    'User Experience (UX)': '660d57eca2510fc4463441b4',
    'User Interface (UI)': '660d57ec3992e594d0f265a0',
    'Responsive Design': '660d57ec4f5ef97e8abee987',
    'Mobile Design': '660d57ec5ba11bc9b9c83ad4',
    'Typography': '660d57ec06e74980e1c28d55',
    'Color Theory': '660d57ec907499473d374276',
    'Web Performance': '660d57ed64de9517e4ae05ac',
    'Content Strategy': '660d57ed2dc9efc426280a34',
    'Lead Generation': '660d57eda6271ef8e836d4da',
    'Branding': '660d57edaf4490dd9841ce59',
    'E-commerce Solutions': '660d57eeff846516c7427a8d',
    'Google Updates': '660d57ec30b508b51342d66d',
    'Backlink Strategies': '660d57edcf5a497059a7e299',
    'Conversion Rate Optimization': '660d57eceff61f9acee8afd4',
    'Social Media Trends': '660d57ed8cb4a375b950eca1',
    'Email Campaigns': '660d57ed71fec30a6fea4146',
  };

  try {
    console.log('Writing blog content for:', topic);
    const contentRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: `You are a web design and digital marketing expert writing for Schiano Studios, a NYC-based web design agency. Write a comprehensive, SEO-optimized blog post about: "${topic}"\n\nReturn ONLY a valid JSON object with these exact fields:\n{\n  "title": "compelling SEO title (max 60 chars)",\n  "slug": "url-friendly-slug-with-dashes",\n  "cardSnippet": "2-sentence preview for blog card (max 150 chars)",\n  "metaDescription": "SEO meta description (max 155 chars)",\n  "readTime": "X min read",\n  "bodyTop": "<h2>Section Title</h2><p>Content...</p> (HTML, ~600 words, first half of post)",\n  "bodyBottom": "<h2>Section Title</h2><p>Content...</p> (HTML, ~600 words, second half of post)",\n  "imageQuery": "specific search query for a relevant Unsplash photo",\n  "midImageQuery": "different specific search query for a second Unsplash photo",\n  "category": "one of: Web Design, SEO & Analytics, Digital Marketing, Development & Tech, Agency Insights, Resources & Tools",\n  "subCategory": "one of: Trends & Inspirations, UX/UI Design Tips, Website Makeovers, Accessibility & Inclusivity, SEO Strategies, Google Analytics Tips, Keyword Research, Local SEO, Content Marketing, Social Media Strategies, Email Marketing, PPC & Ad Campaigns, Frontend Development, Backend Development, Website Security, Emerging Technologies, Behind the Scenes, Client Success Stories, Agency News, Tutorials & Guides, Productivity Tools, Marketing Tools, Design Tools",\n  "tags": ["tag1", "tag2"] (pick 2-4 from: How-To Guides, Best Practices, Industry News, Case Studies, Design Inspiration, SEO Tools, Technical SEO, On-Page SEO, Off-Page SEO, User Experience (UX), User Interface (UI), Responsive Design, Mobile Design, Typography, Color Theory, Web Performance, Content Strategy, Lead Generation, Branding, E-commerce Solutions, Google Updates, Backlink Strategies, Conversion Rate Optimization, Social Media Trends, Email Campaigns)\n}\n\nPick the category and subCategory that best matches the topic. Write in a professional but approachable tone.` }]
      })
    });

    const contentData = await contentRes.json();
    const rawText = contentData.content[0].text;
    const post = JSON.parse(rawText.replace(/\`\`\`json|\`\`\`/g, '').trim());
    console.log('Content generated:', post.title);

    const categoryId = CATEGORIES[post.category] || CATEGORIES['Web Design'];
    const subCategoryId = SUB_CATEGORIES[post.subCategory]?.id || null;
    const tagIds = (post.tags || []).map(t => TAGS[t]).filter(Boolean);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blog-publisher-rose.vercel.app';

    const mainImgRes = await fetch(`${appUrl}/api/upload-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageQuery: post.imageQuery, siteId: SITE_ID, fileName: `blog-main-${post.slug}-${Date.now()}.jpg`, keyword: topic })
    });
    const mainImg = await mainImgRes.json();
    if (!mainImg.success) throw new Error('Main image failed: ' + mainImg.error);

    const midImgRes = await fetch(`${appUrl}/api/upload-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageQuery: post.midImageQuery, siteId: SITE_ID, fileName: `blog-mid-${post.slug}-${Date.now()}.jpg`, keyword: topic })
    });
    const midImg = await midImgRes.json();
    if (!midImg.success) throw new Error('Mid image failed: ' + midImg.error);

    const fieldData = {
      name: post.title, slug: post.slug,
      'post-body-top': post.bodyTop, 'post-body-bottom': post.bodyBottom,
      'card-snippet': post.cardSnippet, 'page-meta-description': post.metaDescription,
      'read-time': post.readTime, 'date': new Date().toISOString(),
      'main-image': { fileId: mainImg.assetId, url: mainImg.hostedUrl, alt: mainImg.altText },
      'main-image---alt-text': mainImg.altText,
      'mid-blog-image': { fileId: midImg.assetId, url: midImg.hostedUrl, alt: midImg.altText },
      'mid-blog-image-alt-text': midImg.altText,
      'bog-category': categoryId,
    };
    if (subCategoryId) fieldData['bog-sub-category'] = subCategoryId;
    if (tagIds.length > 0) fieldData['blog-tags'] = tagIds;

    const createRes = await fetch(`https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}` },
      body: JSON.stringify({ isArchived: false, isDraft: false, fieldData })
    });
    const created = await createRes.json();
    if (!created.id) throw new Error('CMS create failed: ' + JSON.stringify(created));

    if (autoPublish) {
      await fetch(`https://api.webflow.com/v2/collections/${COLLECTION_ID}/items/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}` },
        body: JSON.stringify({ itemIds: [created.id] })
      });
    }

    res.status(200).json({ success: true, title: post.title, slug: post.slug, category: post.category, subCategory: post.subCategory, tags: post.tags, itemId: created.id, published: !!autoPublish });

  } catch (err) {
    console.error('Generate failed:', err.message);
    res.status(500).json({ error: err.message });
  }
}
