import axios from 'axios';

export default async function handler(req, res) {
  const { url, query } = req;
  
  let subPath = query.path;
  if (!subPath) {
    subPath = url.replace(/^\/api\/fund-search/, '').split('?')[0];
  }
  
  if (subPath && !subPath.startsWith('/')) {
    subPath = '/' + subPath;
  }
  
  const queryString = url.includes('?') ? url.substring(url.indexOf('?')) : '';
  const targetUrl = `https://fundsuggest.eastmoney.com${subPath}${queryString}`;
  
  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://fund.eastmoney.com/'
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    res.status(response.status).send(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
