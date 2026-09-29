import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageQuery, siteId, fileName, keyword } = req.body;
  if (!imageQuery || !siteId || !fileName) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Search only the requested subject. A generic fallback produced unrelated images.
    const searchResp = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(imageQuery)}&orientation=landscape&per_page=5`,
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    );
    if (!searchResp.ok) throw new Error('Unsplash search failed: ' + searchResp.status);
    const searchData = await searchResp.json();
    const unsplashData = searchData.results?.find(photo => photo.urls?.regular && (photo.alt_description || photo.description));
    if (!unsplashData) throw new Error('No described image matched the requested search');

    // Alt text describes the visible image. Never append the article title or keywords.
    const altText = (unsplashData.alt_description || unsplashData.description).replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim();

    // Step 3: Download image
    const imgResp = await fetch(unsplashData.urls.regular);
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const fileSize = imgBuffer.byteLength;
    const fileHash = crypto.createHash('sha256').update(imgBuffer).digest('hex');

    // Step 4: Create Webflow asset
    const metaResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
      },
      body: JSON.stringify({ fileName, fileSize, fileHash }),
    });
    const meta = await metaResp.json();
    if (!meta.uploadUrl || !meta.uploadDetails) throw new Error('No uploadUrl: ' + JSON.stringify(meta));

    // Step 5: Upload to S3
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const parts = [];
    for (const [key, value] of Object.entries(meta.uploadDetails)) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
    }
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([Buffer.from(parts.join('') + fileHeader), imgBuffer, Buffer.from(fileFooter)]);

    const s3Resp = await fetch(meta.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    if (s3Resp.status !== 200 && s3Resp.status !== 201) {
      const errText = await s3Resp.text();
      throw new Error('S3 failed: ' + s3Resp.status + ' ' + errText.slice(0, 300));
    }

    res.status(200).json({ success: true, assetId: meta.id, hostedUrl: meta.hostedUrl, altText });
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

