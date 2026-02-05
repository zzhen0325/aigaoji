import axios from 'axios';

export default async function handler(req, res) {
  const { url, query } = req;
  
  let subPath = query.path;
  if (!subPath) {
    subPath = url.split('?')[0].replace(/^\/api\/fund-holdings/, '');
  }
  
  if (subPath) {
    subPath = subPath.startsWith('/') ? subPath : '/' + subPath;
  } else {
    subPath = '/';
  }
  
  const originalUrlObj = new URL(url, 'http://localhost');
  const searchParams = new URLSearchParams(originalUrlObj.search);
  searchParams.delete('path');
  const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
  
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
    
    if (typeof response.data === 'object') {
      res.status(response.status).json(response.data);
    } else {
      res.status(response.status).send(response.data);
    }
  } catch (error) {
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
