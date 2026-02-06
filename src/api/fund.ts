import axios from 'axios';
import { FundInfo, FundHolding, FundValuation } from '@/types';
import { getStockRealtime, getStockTrends } from './stock';
import { getMarketDataSource } from '@/store/marketDataStore';
import dayjs from 'dayjs';

const detailCache = new Map<string, { expiresAt: number; value: FundInfo | null }>();
const detailInflight = new Map<string, Promise<FundInfo | null>>();
const holdingCache = new Map<string, { expiresAt: number; value: FundHolding[] }>();
const holdingInflight = new Map<string, Promise<FundHolding[]>>();
const DETAIL_TTL = 5 * 60 * 1000;
const HOLDING_TTL = 6 * 60 * 60 * 1000;
const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const RETRY_DELAYS = [200, 600];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (!status) return true;
  return status >= 500 || status === 429 || status === 408 || status === 504;
};

const normalizeMarketPrefix = (market: string | number | undefined, code: string) => {
  const normalized = typeof market === 'string' ? market.toLowerCase() : String(market ?? '');
  if (normalized === '1' || normalized === 'sh') return `sh${code}`;
  if (normalized === '0' || normalized === 'sz') return `sz${code}`;
  if (normalized === 'hk') return `hk${code}`;
  if (normalized === 'bj') return `bj${code}`;
  return code;
};

const isBeforeMarketOpen = (time: dayjs.Dayjs) => {
  const minutes = time.hour() * 60 + time.minute();
  return minutes < MARKET_OPEN_MINUTES;
};

const isNetWorthStale = (netWorthDate: string | undefined, time: dayjs.Dayjs) => {
  if (!netWorthDate) return false;
  return dayjs(netWorthDate).isBefore(time, 'day');
};

const shouldSkipNetWorthCalculation = (netWorthDate: string | undefined, time: dayjs.Dayjs) => {
  return isNetWorthStale(netWorthDate, time) && isBeforeMarketOpen(time);
};

const parseFundGzResponse = (data: unknown) => {
  if (typeof data !== 'string') return null;
  const match = data.match(/jsonpgz\((\{.*\})\);?/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.error(error);
    return null;
  }
};

const getFundGzEstimate = async (code: string) => {
  try {
    const url = `/api/fundgz/js/${code}.js?rt=${Date.now()}`;
    const response = await axios.get(url);
    const parsed = parseFundGzResponse(response.data);
    if (!parsed) return null;
    const estimatedValue = parseFloat(parsed.gsz);
    const previousValue = parseFloat(parsed.dwjz);
    const changePercent = parseFloat(parsed.gszzl);
    if (!Number.isFinite(estimatedValue)) return null;
    const baseValue = Number.isFinite(previousValue) ? previousValue : estimatedValue;
    const change = estimatedValue - baseValue;
    const resolvedChangePercent = Number.isFinite(changePercent)
      ? changePercent
      : baseValue > 0 ? (change / baseValue) * 100 : 0;
    return {
      estimatedValue,
      previousValue: baseValue,
      change,
      changePercent: resolvedChangePercent,
      calculationTime: parsed.gztime || dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
  } catch (error) {
    console.error('[API] Failed to get fund gz estimate:', error);
    return null;
  }
};

export const searchFunds = async (keyword: string): Promise<FundInfo[]> => {
  if (!keyword) return [];

  try {
    const url = `/api/fund-search/FundSearch/api/FundSearchAPI.ashx?m=1&key=${keyword}`;
    const response = await axios.get(url);
    const data = response.data;
    const jsonMatch = typeof data === 'string' ? data.match(/=\{.*?\}/) : null;
    let parsedData = data;

    if (jsonMatch) {
      parsedData = JSON.parse(jsonMatch[0].substring(1));
    } else if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        console.error(error);
      }
    }

    if (parsedData && parsedData.Datas) {
      return parsedData.Datas.map((item: { CODE: string; NAME: string; FundBaseInfo?: { FTYPE: string } }) => ({
        code: item.CODE,
        name: item.NAME,
        type: item.FundBaseInfo ? item.FundBaseInfo.FTYPE : 'Unknown'
      }));
    }

    return [];
  } catch (error) {
    console.error('[API] Failed to search funds:', error);
    return [];
  }
};

export const getFundDetails = async (code: string): Promise<FundInfo | null> => {
  const cached = detailCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inflight = detailInflight.get(code);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
        try {
          const url = `/api/fund/pingzhongdata/${code}.js?t=${Date.now()}`;
          const response = await axios.get(url);
          const script = response.data;
          const nameMatch = script.match(/fS_name\s*=\s*"([^"]+)"/);
          const codeMatch = script.match(/fS_code\s*=\s*"([^"]+)"/);
          const typeMatch = script.match(/fS_type\s*=\s*"([^"]+)"/);
          const managerMatch = script.match(/Data_fundManager\s*=\s*(\[[\s\S]*?\]);/);
          const establishDateMatch = script.match(/建立日期\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
          const netWorthMatch = script.match(/Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);

          if (!nameMatch || !codeMatch) {
            if (attempt < RETRY_DELAYS.length) {
              await sleep(RETRY_DELAYS[attempt]);
              continue;
            }
            return null;
          }

          const fund: FundInfo = {
            code: codeMatch[1],
            name: nameMatch[1],
            type: typeMatch ? typeMatch[1] : 'Unknown',
            establishDate: establishDateMatch ? establishDateMatch[1] : ''
          };

          if (managerMatch) {
            try {
              const managers = JSON.parse(managerMatch[1]);
              if (managers.length > 0) {
                fund.manager = managers.map((m: { name: string }) => m.name).join(', ');
              }
            } catch (error) {
              console.error(error);
            }
          }

          if (netWorthMatch) {
            try {
              const netWorthTrend = JSON.parse(netWorthMatch[1]);
              if (netWorthTrend.length > 0) {
                const lastPoint = netWorthTrend[netWorthTrend.length - 1];
                fund.netWorth = lastPoint.y;
                fund.netWorthDate = dayjs(lastPoint.x).format('YYYY-MM-DD');
                const change = typeof lastPoint.equityReturn === 'number' ? lastPoint.equityReturn : parseFloat(lastPoint.equityReturn);
                fund.dayGrowth = Number.isFinite(change) ? `${change.toFixed(2)}%` : undefined;
              }
            } catch (error) {
              console.error(error);
            }
          }

          detailCache.set(code, { expiresAt: Date.now() + DETAIL_TTL, value: fund });
          return fund;
        } catch (error) {
          if (attempt < RETRY_DELAYS.length && isRetryableError(error)) {
            await sleep(RETRY_DELAYS[attempt]);
            continue;
          }
          console.error('[API] Failed to get fund details:', error);
          return null;
        }
      }
      return null;
    } finally {
      detailInflight.delete(code);
    }
  })();

  detailInflight.set(code, request);
  return request;
};

const fetchHoldingsFromFundmob = async (code: string): Promise<FundHolding[]> => {
  try {
    const url = `/api/fund-holdings/FundMNewApi/FundMNInverstPosition?FCODE=${code}&PLATFORM=12&DEVICEID=1`;
    const response = await axios.get(url, { timeout: 8000, validateStatus: () => true });
    if (response.status >= 400) return [];
    const data = response.data;
    const list = Array.isArray(data?.Datas) ? data.Datas : [];
    if (list.length === 0) return [];
    return list
      .map((item: { GPDM?: string; GPJC?: string; JZBL?: string; MARKET?: string | number }) => {
        const stockCodeRaw = item.GPDM ? String(item.GPDM) : '';
        const weight = item.JZBL ? parseFloat(item.JZBL) : 0;
        if (!stockCodeRaw || !Number.isFinite(weight) || weight <= 0) return null;
        const stockCode = normalizeMarketPrefix(item.MARKET, stockCodeRaw);
        return {
          stockCode,
          stockName: item.GPJC || 'Unknown',
          weight,
          market: item.MARKET ? String(item.MARKET) : ''
        } as FundHolding;
      })
      .filter((item): item is FundHolding => Boolean(item));
  } catch {
    return [];
  }
};

const fetchHoldingsFromFundf10 = async (code: string): Promise<FundHolding[]> => {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    try {
      const url = `/api/fundf10/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10`;
      const response = await axios.get(url, { timeout: 15000 });
      const script = response.data;
      const contentMatch = script.match(/content\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (!contentMatch) {
        if (attempt < RETRY_DELAYS.length) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        return [];
      }

      const html = contentMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\//g, '/');

      const holdings = parseHoldingsFromHTML(html);
      const isExplicitEmpty = html.includes('暂无数据');
      if (holdings.length === 0 && !isExplicitEmpty) {
        if (attempt < RETRY_DELAYS.length) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        return [];
      }
      return holdings;
    } catch (error) {
      if (attempt < RETRY_DELAYS.length && isRetryableError(error)) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      return [];
    }
  }
  return [];
};

export const getFundHoldings = async (code: string): Promise<FundHolding[]> => {
  const cached = holdingCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inflight = holdingInflight.get(code);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const source = getMarketDataSource();
      if (source === 'fundmob') {
        const holdings = await fetchHoldingsFromFundmob(code);
        if (holdings.length > 0) {
          holdingCache.set(code, { expiresAt: Date.now() + HOLDING_TTL, value: holdings });
          return holdings;
        }
      }
      const fallbackHoldings = await fetchHoldingsFromFundf10(code);
      holdingCache.set(code, { expiresAt: Date.now() + HOLDING_TTL, value: fallbackHoldings });
      return fallbackHoldings;
    } finally {
      holdingInflight.delete(code);
    }
  })();

  holdingInflight.set(code, request);
  return request;
};

export const getFundIntradayFromHoldings = async (code: string): Promise<{ time: string; value: number; changePercent: number }[]> => {
  const fundInfo = await getFundDetails(code);
  if (!fundInfo?.netWorth) return [];
  const now = dayjs();
  if (shouldSkipNetWorthCalculation(fundInfo.netWorthDate, now)) return [];
  const holdings = await getFundHoldings(code);
  if (holdings.length === 0) return [];

  const stockCodes = holdings.map(h => h.stockCode);
  const trendsMap = await getStockTrends(stockCodes);
  const availableHoldings = holdings.filter(h => trendsMap[h.stockCode]?.points?.length);
  if (availableHoldings.length === 0) return [];

  const totalWeight = availableHoldings.reduce((sum, holding) => sum + holding.weight, 0);
  if (totalWeight === 0) return [];

  const timeSet = new Set<string>();
  const seriesMap = new Map<string, Map<string, number>>();
  availableHoldings.forEach((holding) => {
    const trend = trendsMap[holding.stockCode];
    const map = new Map<string, number>();
    trend.points.forEach((point) => {
      timeSet.add(point.time);
      map.set(point.time, point.price);
    });
    seriesMap.set(holding.stockCode, map);
  });

  const times = Array.from(timeSet).sort();
  const STOCK_POSITION_RATIO = 0.95;

  const series = times.map((time) => {
    let weighted = 0;
    availableHoldings.forEach((holding) => {
      const trend = trendsMap[holding.stockCode];
      const price = seriesMap.get(holding.stockCode)?.get(time);
      if (!price || !trend?.preClose) return;
      const changePercent = ((price - trend.preClose) / trend.preClose) * 100;
      weighted += holding.weight * changePercent;
    });
    const changePercent = (weighted / totalWeight) * STOCK_POSITION_RATIO;
    const value = fundInfo.netWorth * (1 + changePercent / 100);
    return { time, value, changePercent };
  });

  return series;
};

const parseHoldingsFromHTML = (html: string): FundHolding[] => {
  const holdings: FundHolding[] = [];

  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) {
    return holdings;
  }

  const tbody = tbodyMatch[1];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match: RegExpExecArray | null;

  while ((match = trRegex.exec(tbody)) !== null) {
    const row = match[1];

    if (!row.includes('quote.eastmoney.com')) continue;

    let marketPrefix = '';
    let stockCode = '';
    let stockName = 'Unknown';
    let weight = 0;

    const newFormatMatch = row.match(/href=['"][^'"]*unify\/r\/(\d+)\.(\w+)['"]/);
    const oldFormatMatch = row.match(/href=['"][^'"]*quote\.eastmoney\.com\/(?:([a-z]+)\/)?([a-z]*)(\d+)\.html['"]/);

    if (newFormatMatch) {
      const marketId = newFormatMatch[1];
      stockCode = newFormatMatch[2];
      if (marketId === '1') marketPrefix = 'sh';
      else if (marketId === '0') marketPrefix = 'sz';
    } else if (oldFormatMatch) {
      marketPrefix = oldFormatMatch[2] || oldFormatMatch[1] || '';
      stockCode = oldFormatMatch[3];
    }

    if (!stockCode) continue;

    const nameMatches = [...row.matchAll(/>([^<]{2,})<\/a>/g)];
    if (nameMatches.length >= 1) {
      const candidates = nameMatches.filter(m => m[1] !== stockCode && m[1].length > 2);
      stockName = candidates.length > 0 ? candidates[0][1] : nameMatches[0][1];
    }

    const weightMatch = row.match(/>([\d.]+)%</);
    if (weightMatch) {
      weight = parseFloat(weightMatch[1]);
    }

    if (stockCode && weight > 0) {
      let fullCode = stockCode;
      if (marketPrefix) {
        fullCode = `${marketPrefix.toLowerCase()}${stockCode}`;
      }

      holdings.push({
        stockCode: fullCode,
        stockName,
        weight,
        market: marketPrefix
      });
    }
  }

  return holdings;
};

export const getFundValuation = async (code: string): Promise<FundValuation | null> => {
  try {
    const fundInfo = await getFundDetails(code);
    if (!fundInfo || !fundInfo.netWorth) {
      const gzEstimate = await getFundGzEstimate(code);
      if (gzEstimate) {
        return {
          fundCode: code,
          ...gzEstimate,
          holdings: [],
          totalWeight: 0
        };
      }
      throw new Error('Fund info or net worth not found');
    }
    const now = dayjs();
    if (shouldSkipNetWorthCalculation(fundInfo.netWorthDate, now)) {
      return {
        fundCode: code,
        estimatedValue: fundInfo.netWorth,
        previousValue: fundInfo.netWorth,
        change: 0,
        changePercent: 0,
        calculationTime: now.format('YYYY-MM-DD HH:mm:ss'),
        holdings: [],
        totalWeight: 0
      };
    }

    const holdings = await getFundHoldings(code);
    if (holdings.length === 0) {
      const gzEstimate = await getFundGzEstimate(code);
      if (gzEstimate) {
        return {
          fundCode: code,
          ...gzEstimate,
          holdings: [],
          totalWeight: 0
        };
      }
      return {
        fundCode: code,
        estimatedValue: fundInfo.netWorth,
        previousValue: fundInfo.netWorth,
        change: 0,
        changePercent: 0,
        calculationTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        holdings: [],
        totalWeight: 0
      };
    }

    const stockCodes = holdings.map(h => h.stockCode);
    const stockPrices = await getStockRealtime(stockCodes);

    let totalWeightedChange = 0;
    let totalWeight = 0;

    const holdingsWithRealtime = holdings.map((holding) => {
      const stock = stockPrices.find(s => s.code === holding.stockCode || s.code.endsWith(holding.stockCode));

      if (stock) {
        totalWeightedChange += holding.weight * stock.changePercent;
        totalWeight += holding.weight;
        return { stock: holding, realtime: stock };
      }
      return { stock: holding, realtime: null };
    });

    const validTotalWeight = totalWeight > 0 ? totalWeight : 100;
    const STOCK_POSITION_RATIO = 0.95;

    let estimatedChangePercent = (totalWeightedChange / validTotalWeight) * STOCK_POSITION_RATIO;
    if (totalWeight === 0) estimatedChangePercent = 0;

    const estimatedValue = fundInfo.netWorth * (1 + estimatedChangePercent / 100);
    const changeValue = estimatedValue - fundInfo.netWorth;

    return {
      fundCode: code,
      estimatedValue,
      previousValue: fundInfo.netWorth,
      change: changeValue,
      changePercent: estimatedChangePercent,
      calculationTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      holdings: holdingsWithRealtime,
      totalWeight
    };
  } catch (error) {
    console.error('[API] Failed to calculate valuation:', error);
    return null;
  }
};
