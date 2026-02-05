import axios from 'axios';

export default async function handler(req, res) {
  const { url, query } = req;
  
  // Try to get path from query param (set by Vercel rewrite)
  let subPath = query.path;
  
  // If no path in query, try to extract from URL
  if (!subPath) {
    subPath = url.split('?')[0].replace(/^\/api\/fundgz/, '');
  }
  
  // Clean up subPath: ensure it doesn't have multiple leading slashes
  // and handle encoded paths if necessary
  if (subPath) {
    subPath = subPath.startsWith('/') ? subPath : '/' + subPath;
  } else {
    subPath = '/';
  }
  
  // Get query string from the original URL, BUT EXCLUDE the 'path' parameter
  // which was injected by Vercel's rewrite rules
  const originalUrlObj = new URL(url, 'http://localhost');
  const searchParams = new URLSearchParams(originalUrlObj.search);
  searchParams.delete('path');
  const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
  
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
    
    // Check if the response is JSON or text/JS
    if (typeof response.data === 'object') {
      res.status(response.status).json(response.data);
    } else {
      res.status(response.status).send(response.data);
    }
  } catch (error) {
    console.error(`[Proxy Error] ${url}:`, error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message,
      url: url,
      targetUrl: targetUrl
    });
  }
}
