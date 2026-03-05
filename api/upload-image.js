export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { uploadUrl, imageUrl } = req.body;
  if (!uploadUrl || !imageUrl) return res.status(400).json({ error: 'Missing uploadUrl or imageUrl' });

  try {
    // Download image from Unsplash
    const imgResp = await fetch(imageUrl);
    const imgBuffer = await imgResp.arrayBuffer();

    // Upload to Webflow S3
    const uploadResp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: imgBuffer,
    });

    if (!uploadResp.ok) {
      return res.status(uploadResp.status).json({ error: 'S3 upload failed', status: uploadResp.status });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
