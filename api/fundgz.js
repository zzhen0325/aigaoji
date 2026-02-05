export default async function handler(req, res) {
  const { url = '' } = req;
  const targetPath = url.replace(/^\/api\/fundgz/, '');
  const targetUrl = new URL(targetPath || '/', 'https://fundgz.1234567.com.cn').toString();

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://fundgz.1234567.com.cn/',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    const data = await response.text();
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=15');
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
