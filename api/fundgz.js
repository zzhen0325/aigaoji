import axios from 'axios';

export default async function handler(req, res) {
  const { url, query } = req;
  
  // Try to get path from query param (set by Vercel rewrite) or from the URL
  let subPath = query.path;
  if (!subPath) {
    subPath = url.replace(/^\/api\/fundgz/, '').split('?')[0];
  }
  
  // Ensure subPath starts with /
  if (subPath && !subPath.startsWith('/')) {
    subPath = '/' + subPath;
  }
  
  // Get query string from the original URL
  const queryString = url.includes('?') ? url.substring(url.indexOf('?')) : '';
  
  // Construct target URL
  const targetUrl = `https://fundgz.1234567.com.cn${subPath}${queryString}`;
  
  console.log(`[Proxy] ${url} -> ${targetUrl}`);

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://fundgz.1234567.com.cn/',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 10000,
      validateStatus: () => true
    });

    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    } else {
      res.setHeader('Content-Type', 'text/javascript;charset=UTF-8');
    }
    
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=15');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error(`[Proxy Error] ${url}:`, error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message,
      url: url,
      targetUrl: targetUrl,
      query: query
    });
  }
}
