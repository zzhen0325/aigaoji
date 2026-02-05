export default async function handler(req, res) {
  const { url } = req;
  const targetUrl = `http://hq.sinajs.cn${url.replace(/^\/api\/stock/, '')}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://finance.sina.com.cn/'
      }
    });
    const data = await response.arrayBuffer();
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=5');
    // Sina API often uses GBK encoding, but we'll send it as is for now
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
