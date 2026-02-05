import axios from 'axios';

export default async function handler(req, res) {
  const { url, query } = req;
  
  let subPath = query.path;
  if (!subPath) {
    subPath = url.split('?')[0].replace(/^\/api\/fund-search/, '');
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
  
  const targetUrl = `https://fundsuggest.eastmoney.com${subPath}${queryString}`;
  
  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://fund.eastmoney.com/',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Connection': 'keep-alive'
      },
      timeout: 15000,
      validateStatus: () => true
    });
    
    if (response.status >= 400) {
      console.error(`[Proxy Error] ${targetUrl} returned status ${response.status}`);
    }
    
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
