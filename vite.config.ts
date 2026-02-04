import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api/fund-search': {
        target: 'https://fundsuggest.eastmoney.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/fund-search/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://fund.eastmoney.com/'
        }
      },
      '/api/fund-holdings': {
        target: 'https://fundmobapi.eastmoney.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/fund-holdings/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
          'Referer': 'https://fund.eastmoney.com/'
        }
      },
      '/api/stock': {
        target: 'http://hq.sinajs.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stock/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://finance.sina.com.cn/'
        }
      },
      '/api/stock-trends': {
        target: 'https://push2his.eastmoney.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/stock-trends/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://quote.eastmoney.com/'
        }
      },
      '/api/fund': {
        target: 'https://fund.eastmoney.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/fund/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://fund.eastmoney.com/'
        }
      }
    }
  },
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    {
      name: 'local-users-persistence',
      configureServer(server) {
        server.middlewares.use('/api/local-users', async (req, res, next) => {
          const filePath = path.resolve(__dirname, 'users.json');

          if (req.method === 'GET') {
            try {
              if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data || '[]');
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.end('[]');
              }
            } catch (error) {
              console.error('Failed to read users', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to read users' }));
            }
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                // Verify it is valid JSON
                JSON.parse(body);
                fs.writeFileSync(filePath, body, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (error) {
                console.error('Failed to save users', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to save users' }));
              }
            });
            return;
          }
          
          next();
        });

        server.middlewares.use('/api/local-portfolios', async (req, res, next) => {
          const filePath = path.resolve(__dirname, 'portfolios.json');

          if (req.method === 'GET') {
            try {
              if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data || '{}');
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.end('{}');
              }
            } catch (error) {
              console.error('Failed to read portfolios', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to read portfolios' }));
            }
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                // Verify it is valid JSON
                JSON.parse(body);
                fs.writeFileSync(filePath, body, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (error) {
                console.error('Failed to save portfolios', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to save portfolios' }));
              }
            });
            return;
          }
          
          next();
        });
      }
    },
    {
      name: 'fundf10-proxy',
      configureServer(server) {
        server.middlewares.use('/api/fundf10', async (req, res, next) => {
          if (!req.url) return next();
          const targetUrl = `https://fundf10.eastmoney.com${req.url.replace(/^\/api\/fundf10/, '')}`;
          try {
            const response = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://fundf10.eastmoney.com/'
              }
            });
            const text = await response.text();
            res.statusCode = response.status;
            const contentType = response.headers.get('content-type');
            if (contentType) res.setHeader('Content-Type', contentType);
            res.end(text);
          } catch (error) {
            console.error('FundF10 proxy error', error);
            res.statusCode = 502;
            res.end('');
          }
        });
        server.middlewares.use('/api/stock-trends', async (req, res, next) => {
          if (!req.url) return next();
          const targetUrl = `https://push2his.eastmoney.com${req.url.replace(/^\/api\/stock-trends/, '')}`;
          try {
            const response = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://quote.eastmoney.com/'
              }
            });
            const text = await response.text();
            res.statusCode = response.status;
            const contentType = response.headers.get('content-type');
            if (contentType) res.setHeader('Content-Type', contentType);
            res.end(text);
          } catch (error) {
            console.error('Stock trends proxy error', error);
            res.statusCode = 502;
            res.end('');
          }
        });
      }
    },
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
})
