export default async function handler(req, res) {
  const { url } = req;
  const targetUrl = `https://fundf10.eastmoney.com${url.replace(/^\/api\/fundf10/, '')}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://fundf10.eastmoney.com/'
      }
    });
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
