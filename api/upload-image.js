import crypto from 'crypto';
import FormData from 'form-data';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, siteId, fileName } = req.body;
  if (!imageUrl || !siteId || !fileName) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Download image server-side
    const imgResp = await fetch(imageUrl);
    const imgArrayBuffer = await imgResp.arrayBuffer();
    const imgBuffer = Buffer.from(imgArrayBuffer);
    const imgSize = imgBuffer.byteLength;
    const hashHex = crypto.createHash('sha256').update(imgBuffer).digest('hex');

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
    console.log('Webflow asset response:', JSON.stringify(metaData));
    if (!metaData.uploadUrl || !metaData.uploadDetails || !metaData.id) {
      throw new Error('Webflow asset creation failed: ' + JSON.stringify(metaData));
    }

    // Build multipart form with uploadDetails fields + file
    const form = new FormData();
    for (const [key, value] of Object.entries(metaData.uploadDetails)) {
      form.append(key, value);
    }
    form.append('file', imgBuffer, { filename: fileName, contentType: 'image/jpeg' });

    // POST to S3
    const uploadResp = await fetch(metaData.uploadUrl, {
      method: 'POST',
      headers: form.getHeaders(),
      body: form,
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      console.log('S3 error:', errText);
      throw new Error('S3 upload failed: ' + uploadResp.status + ' ' + errText);
    }

    res.status(200).json({ success: true, assetId: metaData.id });
  } catch (err) {
    console.log('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
