import axios from 'axios';
import { StockRealtime } from '@/types';
import dayjs from 'dayjs';

// Helper to fix stock code prefix for Sina
const formatStockCode = (code: string, market?: string) => {
  const cleanCode = code.toLowerCase();
  // If already has prefix
  if (cleanCode.startsWith('sh') || cleanCode.startsWith('sz') || cleanCode.startsWith('hk') || cleanCode.startsWith('bj')) return cleanCode;
  
  // If market is provided (from Eastmoney marketId or link prefix)
  if (market === '1' || market === 'sh') return `sh${cleanCode}`;
  if (market === '0' || market === 'sz') return `sz${cleanCode}`;
  if (market === 'hk') return `hk${cleanCode}`;
  if (market === 'bj') return `bj${cleanCode}`;
  
  // Heuristic if market not provided
  if (cleanCode.length === 5) return `hk${cleanCode}`; // HK stocks usually 5 digits
  if (cleanCode.startsWith('6')) return `sh${cleanCode}`;
  if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) return `sz${cleanCode}`;
  if (cleanCode.startsWith('4') || cleanCode.startsWith('8')) return `bj${cleanCode}`; 
  
  return cleanCode;
};

export const getStockRealtime = async (codes: string[]): Promise<StockRealtime[]> => {
  if (codes.length === 0) return [];
  
  const formattedCodes = codes.map(c => formatStockCode(c));
  const uniqueCodes = [...new Set(formattedCodes)];
  const listParam = uniqueCodes.join(',');
  
  try {
    const response = await axios.get(`/api/stock/list=${listParam}`, {
      responseType: 'arraybuffer'
    });
    
    const decoder = new TextDecoder('gbk');
    const text = decoder.decode(response.data);
    
    const results: StockRealtime[] = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (!line.trim()) return;
      
      const match = line.match(/var hq_str_([a-zA-Z0-9]+)="([^"]+)";/);
      if (match) {
        const code = match[1];
        const dataStr = match[2];
        const parts = dataStr.split(',');
        
        if (parts.length < 10) return;

        let name = '';
        let current = 0;
        let preClose = 0;
        let open = 0;
        let high = 0;
        let low = 0;
        let volume = 0;
        let date = '';
        let time = '';

        const isHK = code.startsWith('hk');

        if (isHK) {
            // SINA HK Format
            name = parts[1];
            open = parseFloat(parts[2]);
            preClose = parseFloat(parts[3]);
            high = parseFloat(parts[4]);
            low = parseFloat(parts[5]);
            current = parseFloat(parts[6]);
            date = dayjs().format('YYYY-MM-DD'); 
            time = dayjs().format('HH:mm:ss');
        } else {
            // A Share Format
            name = parts[0];
            open = parseFloat(parts[1]);
            preClose = parseFloat(parts[2]);
            current = parseFloat(parts[3]);
            high = parseFloat(parts[4]);
            low = parseFloat(parts[5]);
            volume = parseFloat(parts[8]);
            date = parts[30];
            time = parts[31];
        }
          
          const price = current > 0 ? current : preClose;
          const change = price - preClose;
          const changePercent = preClose > 0 ? (change / preClose) * 100 : 0;
          
          results.push({
            code,
            name,
            currentPrice: price,
            change,
            changePercent,
            open,
            high,
            low,
            volume,
            time: `${date} ${time}`
          });
      }
    });
    
    return results;
    
  } catch (error) {
    console.error('Failed to get stock realtime', error);
    return [];
  }
};

export const getStockTrends = async (codes: string[]): Promise<Record<string, { preClose: number; points: { time: string; price: number }[] }>> => {
  if (codes.length === 0) return {};
  const formattedCodes = codes.map(c => formatStockCode(c));
  const uniqueCodes = [...new Set(formattedCodes)];
  const result: Record<string, { preClose: number; points: { time: string; price: number }[] }> = {};

  await Promise.all(uniqueCodes.map(async (code) => {
    const secid = code.startsWith('sh')
      ? `1.${code.replace(/^sh/, '')}`
      : code.startsWith('sz')
        ? `0.${code.replace(/^sz/, '')}`
        : code.startsWith('bj')
          ? `0.${code.replace(/^bj/, '')}`
          : '';
    if (!secid) return;
    try {
      const url = `/api/stock-trends/api/qt/stock/trends2/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=fa5fd1943c7b386f172d6893dbfba10b&ndays=1&iscr=0&iscca=0`;
      const response = await axios.get(url);
      const data = response.data?.data;
      if (!data || !Array.isArray(data.trends)) return;
      const series = data.trends.map((item: string) => {
        const parts = item.split(',');
        return { time: parts[0].slice(11, 16), price: parseFloat(parts[1]) };
      }).filter(p => !Number.isNaN(p.price));
      const preClose = typeof data.preClose === 'number' ? data.preClose : parseFloat(data.preClose);
      if (!Number.isNaN(preClose)) {
        result[code] = { preClose, points: series };
      }
    } catch (error) {
      console.error('Failed to get stock trends', error);
    }
  }));

  return result;
};
