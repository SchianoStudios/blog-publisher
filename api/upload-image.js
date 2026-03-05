import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, siteId, fileName } = req.body;
  if (!imageUrl || !siteId || !fileName) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Download image server-side (no CORS issues)
    const imgResp = await fetch(imageUrl);
    const imgBuffer = await imgResp.arrayBuffer();
    const imgSize = imgBuffer.byteLength;
    const hashHex = crypto.createHash('sha256').update(Buffer.from(imgBuffer)).digest('hex');

    // Create Webflow asset metadata
    const metaResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
      },
      body: JSON.stringify({ fileName, fileSize: imgSize, fileHash: hashHex, mimeType: 'image/jpeg' }),
    });
    const metaData = await metaResp.json();
    if (!metaData.uploadUrl || !metaData.id) throw new Error('Webflow asset creation failed: ' + JSON.stringify(metaData));

    // Upload to S3
    const uploadResp = await fetch(metaData.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: imgBuffer,
    });
    if (!uploadResp.ok) throw new Error('S3 upload failed: ' + uploadResp.status);

    res.status(200).json({ success: true, assetId: metaData.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
