import axios from 'axios';

export default async function handler(req, res) {
  const { url, query } = req;
  
  let subPath = query.path;
  if (!subPath) {
    subPath = url.replace(/^\/api\/fund-holdings/, '').split('?')[0];
  }
  
  if (subPath && !subPath.startsWith('/')) {
    subPath = '/' + subPath;
  }
  
  const queryString = url.includes('?') ? url.substring(url.indexOf('?')) : '';
  const targetUrl = `https://fundmobapi.eastmoney.com${subPath}${queryString}`;
  
  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
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
