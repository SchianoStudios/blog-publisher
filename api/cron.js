// api/cron.js
// Vercel Cron Job — runs daily to auto-publish a blog post
// Protected by CRON_SECRET env variable

export default async function handler(req, res) {
  // Security check — only allow Vercel cron or requests with the secret
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🤖 Daily blog cron starting...');

    // Step 1: Pick a topic using Claude
    const topic = await generateTopic();
    console.log(`📝 Topic selected: ${topic}`);

    // Step 2: Call the existing blog generation endpoint
    const blogRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://blog-publisher-rose.vercel.app'}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({
        topic,
        autoPublish: true
      })
    });

    if (!blogRes.ok) {
      const err = await blogRes.text();
      throw new Error(`Blog generation failed: ${err}`);
    }

    const result = await blogRes.json();
    console.log(`✅ Published: ${result.title}`);

    return res.status(200).json({
      success: true,
      topic,
      title: result.title,
      slug: result.slug,
      publishedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Uses Claude to pick a fresh, SEO-relevant topic each day
async function generateTopic() {
  const categories = {
    'Web Design': ['Trends & Inspirations', 'UX/UI Design Tips', 'Website Makeovers', 'Accessibility & Inclusivity'],
    'SEO & Analytics': ['SEO Strategies', 'Google Analytics Tips', 'Keyword Research', 'Local SEO'],
    'Digital Marketing': ['Content Marketing', 'Social Media Strategies', 'Email Marketing', 'PPC & Ad Campaigns'],
    'Development & Tech': ['Frontend Development', 'Backend Development', 'Website Security', 'Emerging Technologies'],
    'Agency Insights': ['Behind the Scenes', 'Client Success Stories', 'Agency News'],
    'Resources & Tools': ['Tutorials & Guides', 'Productivity Tools', 'Marketing Tools', 'Design Tools'],
  };

  const categoryNames = Object.keys(categories);
  const randomCategory = categoryNames[Math.floor(Math.random() * categoryNames.length)];
  const subCategories = categories[randomCategory];
  const randomSubCategory = subCategories[Math.floor(Math.random() * subCategories.length)];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `You are a content strategist for Schiano Studios, a NYC web design agency. Generate ONE specific blog post topic that fits exactly within this category: "${randomCategory}" and sub-category: "${randomSubCategory}". The topic should be practical and valuable for small business owners. Return only the topic title, nothing else. Do not include the year unless truly essential.`
      }]
    })
  });

  const data = await response.json();
  return data.content[0].text.trim();
}
