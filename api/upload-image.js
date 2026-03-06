import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageQuery, siteId, fileName } = req.body;
  if (!imageQuery || !siteId || !fileName) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Step 1: Get a real image from Unsplash API
    const unsplashResp = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(imageQuery)}&orientation=landscape`,
      { headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    );
    const unsplashData = await unsplashResp.json();
    const imageUrl = unsplashData.urls?.regular || unsplashData.urls?.full;
    if (!imageUrl) throw new Error('No image from Unsplash: ' + JSON.stringify(unsplashData));
    console.log('Unsplash image URL:', imageUrl);

    // Step 2: Download the image
    const imgResp = await fetch(imageUrl);
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const fileSize = imgBuffer.byteLength;
    const fileHash = crypto.createHash('sha256').update(imgBuffer).digest('hex');

    // Step 3: Create Webflow asset
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

    // Step 4: Upload to S3 via multipart form
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

    console.log('S3 status:', s3Resp.status);
    if (s3Resp.status !== 200 && s3Resp.status !== 201) {
      const errText = await s3Resp.text();
      throw new Error('S3 failed: ' + s3Resp.status + ' ' + errText.slice(0, 300));
    }

    res.status(200).json({ 
      success: true, 
      assetId: meta.id,
      hostedUrl: meta.hostedUrl,
      previewUrl: imageUrl
    });
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
