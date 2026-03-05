import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, siteId, fileName } = req.body;
  if (!imageUrl || !siteId || !fileName) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Download image
    const imgResp = await fetch(imageUrl, { redirect: 'follow' });
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const fileSize = imgBuffer.byteLength;
    const fileHash = crypto.createHash('sha256').update(imgBuffer).digest('hex');

    // Step 1: Create asset in Webflow
    const metaResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
      },
      body: JSON.stringify({ fileName, fileSize, fileHash }),
    });
    const meta = await metaResp.json();
    console.log('Webflow meta:', JSON.stringify(meta));
    if (!meta.uploadUrl || !meta.uploadDetails) throw new Error('No uploadUrl: ' + JSON.stringify(meta));

    // Step 2: Build multipart body manually
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const parts = [];
    
    for (const [key, value] of Object.entries(meta.uploadDetails)) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
    }
    
    // File must be last
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;
    
    const headerBuf = Buffer.from(parts.join('') + fileHeader);
    const footerBuf = Buffer.from(fileFooter);
    const body = Buffer.concat([headerBuf, imgBuffer, footerBuf]);

    // Step 3: POST to S3
    const s3Resp = await fetch(meta.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    if (!s3Resp.ok) {
      const errText = await s3Resp.text();
      console.log('S3 error:', errText);
      throw new Error('S3 failed: ' + s3Resp.status + ' ' + errText.slice(0, 200));
    }

    res.status(200).json({ success: true, assetId: meta.id });
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
