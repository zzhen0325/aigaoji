export default async function handler(req, res) {
  const { url } = req;
  const targetUrl = `https://fundmobapi.eastmoney.com${url.replace(/^\/api\/fund-holdings/, '')}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
        'Referer': 'https://fund.eastmoney.com/'
      }
    });
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
