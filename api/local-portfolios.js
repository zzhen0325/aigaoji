import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const filePath = path.join(process.cwd(), 'portfolios.json');

  if (req.method === 'GET') {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        res.status(200).json(JSON.parse(data || '{}'));
      } else {
        res.status(200).json({});
      }
    } catch (e) {
      res.status(200).json({});
    }
  } else if (req.method === 'POST') {
    res.status(200).json({ success: true, message: 'Persistence not available in serverless mode. Data stored in browser only.' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
