import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getFundDetails, getFundIntradayFromHoldings, getFundValuation } from '@/api/fund';
import { FundInfo, FundValuation, UserPortfolio } from '@/types';
import { ArrowUp, ArrowDown, RefreshCw, Clock, Info, Plus, BarChart3, ArrowRightLeft } from 'lucide-react';
import dayjs from 'dayjs';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useUserStore } from '../../store/userStore';
import { getUserPortfolio } from '../../api/portfolio';
import { TransactionModal } from '../../components/TransactionModal';
import { AddFundModal } from '../../components/AddFundModal';

const isMarketOpenTime = (time: dayjs.Dayjs) => {
  const minutes = time.hour() * 60 + time.minute();
  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;
  return (minutes >= morningStart && minutes <= morningEnd) || (minutes >= afternoonStart && minutes <= afternoonEnd);
};

const clampToTradingLabel = (time: dayjs.Dayjs) => {
  const minutes = time.hour() * 60 + time.minute();
  const start = 9 * 60 + 30;
  const end = 15 * 60;
  if (minutes <= start) return '09:30';
  if (minutes >= end) return '15:00';
  return time.format('HH:mm');
};

const getIntradayStorageKey = (fundCode: string, date: string) => `intraday-${fundCode}-${date}`;
const getIntradayLatestKey = (fundCode: string) => `intraday-${fundCode}-latest`;
const getIntradayBackfillKey = (fundCode: string, date: string) => `intraday-${fundCode}-${date}-backfilled`;

const FundDetail: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [info, setInfo] = useState<FundInfo | null>(null);
  const [valuation, setValuation] = useState<FundValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [intradayData, setIntradayData] = useState<{ time: string; value: number; changePercent: number }[]>([]);
  const [userFundInfo, setUserFundInfo] = useState<UserPortfolio | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { currentUser } = useUserStore();

  const loadUserFundInfo = useCallback(async () => {
    if (currentUser && code) {
      const portfolio = await getUserPortfolio(currentUser.username);
      const found = portfolio.find(p => p.fundCode === code);
      setUserFundInfo(found || null);
    }
  }, [currentUser, code]);

  useEffect(() => {
    loadUserFundInfo();
  }, [loadUserFundInfo]);

  const loadIntradayData = useCallback((fundCode: string) => {
    const todayKey = getIntradayStorageKey(fundCode, dayjs().format('YYYY-MM-DD'));
    const todayRaw = localStorage.getItem(todayKey);
    if (todayRaw) {
      try {
        const parsed = JSON.parse(todayRaw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse intraday data from localStorage', e);
      }
    }
    const latestRaw = localStorage.getItem(getIntradayLatestKey(fundCode));
    if (latestRaw) {
      try {
        const parsed = JSON.parse(latestRaw);
        if (Array.isArray(parsed?.data)) return parsed.data;
      } catch (e) {
        console.error('Failed to parse latest intraday data', e);
      }
    }
    return [];
  }, []);

  const saveIntradayData = useCallback((fundCode: string, data: { time: string; value: number; changePercent: number }[]) => {
    const dateKey = getIntradayStorageKey(fundCode, dayjs().format('YYYY-MM-DD'));
    localStorage.setItem(dateKey, JSON.stringify(data));
    localStorage.setItem(getIntradayLatestKey(fundCode), JSON.stringify({ date: dayjs().format('YYYY-MM-DD'), data }));
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!code) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [infoData, valData] = await Promise.all([
        getFundDetails(code),
        getFundValuation(code)
      ]);
      setInfo(infoData);
      setValuation(valData);
      const now = dayjs();
      setLastUpdated(now.format('HH:mm:ss'));
      const todayKey = getIntradayBackfillKey(code, now.format('YYYY-MM-DD'));
      if (!isMarketOpenTime(now) && intradayData.length <= 2 && valData?.estimatedValue !== undefined && !localStorage.getItem(todayKey)) {
        try {
          const backfilled = await getFundIntradayFromHoldings(code);
          if (backfilled.length >= 30) {
            setIntradayData(backfilled);
            saveIntradayData(code, backfilled);
          }
        } finally {
          localStorage.setItem(todayKey, '1');
        }
      }
      if (valData?.estimatedValue !== undefined && isMarketOpenTime(now)) {
        setIntradayData((prev) => {
          const time = now.format('HH:mm');
          const point = { time, value: valData.estimatedValue, changePercent: valData.changePercent };
          if (prev.length === 0) return [point];
          const last = prev[prev.length - 1];
          if (last.time === time) {
            const updated = [...prev];
            updated[updated.length - 1] = point;
            saveIntradayData(code, updated);
            return updated;
          }
          const next = [...prev, point];
          const trimmed = next.length > 240 ? next.slice(next.length - 240) : next;
          saveIntradayData(code, trimmed);
          return trimmed;
        });
      } else if (valData?.estimatedValue !== undefined && intradayData.length === 0) {
        const backfilled = await getFundIntradayFromHoldings(code);
        if (backfilled.length >= 30) {
          setIntradayData(backfilled);
          saveIntradayData(code, backfilled);
        } else {
          const baseValue = valData.previousValue ?? infoData?.netWorth ?? valData.estimatedValue;
          const endTime = clampToTradingLabel(now);
          const seed =
            endTime === '09:30'
              ? [{ time: '09:30', value: baseValue, changePercent: 0 }]
              : [
                  { time: '09:30', value: baseValue, changePercent: 0 },
                  { time: endTime, value: valData.estimatedValue, changePercent: valData.changePercent }
                ];
          setIntradayData(seed);
          saveIntradayData(code, seed);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [code, intradayData.length, saveIntradayData]);

  useEffect(() => {
    if (code) {
      const stored = loadIntradayData(code);
      setIntradayData(stored);
    }
    fetchData();
    const timer = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(timer);
  }, [code, fetchData, loadIntradayData]);

  if (loading && !info) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-google-primary"></div>
      </div>
    );
  }

  if (!info) {
    return <div className="text-center py-12 text-google-text-secondary dark:text-google-text-secondary-dark">未找到基金</div>;
  }

  const isUp = (valuation?.changePercent || 0) >= 0;
  // Google Red/Green Semantic Colors
  const ColorClass = isUp ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark';
  const BgClass = isUp ? 'bg-google-red/10 dark:bg-google-red-dark/10' : 'bg-google-green/10 dark:bg-google-green-dark/10';
  const StrokeColor = isUp ? (document.documentElement.classList.contains('dark') ? '#F2B8B5' : '#B3261E') : (document.documentElement.classList.contains('dark') ? '#6DD58C' : '#146C2E');

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <div className="flex items-center gap-2">
                <h1 className="text-2xl font-normal text-google-text dark:text-google-text-dark">{info.name}</h1>
                <span className="text-xs bg-google-surface dark:bg-google-surface-dark px-2 py-1 rounded text-google-text-secondary dark:text-google-text-secondary-dark font-mono">
                    {info.code}
                </span>
           </div>
           <p className="text-google-text-secondary dark:text-google-text-secondary-dark text-sm mt-1">
             {info.type} · {info.manager || '未知'}
           </p>
        </div>
        <div className="flex space-x-3">
            {userFundInfo && (
              <button 
                  onClick={() => setIsTransactionModalOpen(true)}
                  className="flex items-center px-6 py-2 bg-google-surface dark:bg-google-surface-dark text-google-primary dark:text-google-primary-dark rounded-full font-medium hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors"
              >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  交易
              </button>
            )}
            <button 
                onClick={() => userFundInfo ? setIsTransactionModalOpen(true) : setIsAddModalOpen(true)}
                className="flex items-center px-6 py-2 bg-google-primary dark:bg-google-primary-dark text-white dark:text-google-bg-dark rounded-full font-medium hover:shadow-md transition-shadow"
            >
                <Plus className="h-4 w-4 mr-2" />
                {userFundInfo ? '已在持仓' : '添加持仓'}
            </button>
            <button 
                onClick={() => fetchData(true)}
                className={`p-2 rounded-full bg-google-surface dark:bg-google-surface-dark text-google-text-secondary dark:text-google-text-secondary-dark hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors ${refreshing ? 'animate-spin' : ''}`}
            >
                <RefreshCw className="h-5 w-5" />
            </button>
        </div>
      </div>

      {/* Main Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real-time Valuation Card */}
        <div className="lg:col-span-2 bg-google-surface dark:bg-google-surface-dark rounded-[24px] p-6 flex flex-col justify-between min-h-[300px]">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-google-text-secondary dark:text-google-text-secondary-dark" />
                    <span className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark">实时估值</span>
                    <span className="text-xs text-google-text-secondary dark:text-google-text-secondary-dark opacity-60">
                        {lastUpdated}
                    </span>
                </div>
                
                <div className="flex items-baseline gap-4 mt-4">
                    <span className={`text-6xl font-normal tracking-tighter ${ColorClass}`}>
                        {valuation?.estimatedValue.toFixed(4)}
                    </span>
                    <div className={`flex items-center px-3 py-1 rounded-full ${BgClass}`}>
                        {isUp ? <ArrowUp className={`h-4 w-4 ${ColorClass}`} /> : <ArrowDown className={`h-4 w-4 ${ColorClass}`} />}
                        <span className={`font-medium ml-1 ${ColorClass}`}>
                            {valuation?.changePercent.toFixed(2)}%
                        </span>
                    </div>
                </div>
                <div className={`mt-2 text-lg font-medium ${ColorClass}`}>
                    {valuation?.change > 0 ? '+' : ''}{valuation?.change.toFixed(4)}
                </div>
            </div>

            {/* Chart Area */}
            <div className="h-48 mt-6 w-full">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={intradayData}>
                    <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={StrokeColor} stopOpacity={0.1}/>
                        <stop offset="95%" stopColor={StrokeColor} stopOpacity={0}/>
                    </linearGradient>
                    </defs>
                    <XAxis 
                        dataKey="time" 
                        hide 
                    />
                    <YAxis 
                        domain={['auto', 'auto']} 
                        hide
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#1E1F20', 
                            borderColor: '#1E1F20', 
                            borderRadius: '12px',
                            color: '#fff',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        itemStyle={{ color: '#E3E3E3' }}
                        formatter={(value: number) => [value.toFixed(4), '估值']} 
                        labelFormatter={(label) => `${label}`} 
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={StrokeColor} 
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        strokeWidth={2}
                    />
                </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Stats Card */}
        <div className="space-y-6">
            <div className="bg-google-surface dark:bg-google-surface-dark rounded-[24px] p-6 h-full">
                <div className="flex items-center gap-2 mb-6">
                    <Info className="h-5 w-5 text-google-text-secondary dark:text-google-text-secondary-dark" />
                    <span className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark">昨日净值</span>
                </div>
                
                <div className="flex flex-col gap-1">
                    <span className="text-4xl font-normal text-google-text dark:text-google-text-dark">
                        {info.netWorth?.toFixed(4)}
                    </span>
                    <span className={`text-lg font-medium ${(parseFloat(info.dayGrowth || '0') >= 0) ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                        {info.dayGrowth && parseFloat(info.dayGrowth) > 0 ? '+' : ''}{info.dayGrowth}%
                    </span>
                    <span className="text-sm text-google-text-secondary dark:text-google-text-secondary-dark mt-2">
                        {info.netWorthDate}
                    </span>
                </div>
            </div>
            
            {/* <div className="bg-google-surface dark:bg-google-surface-dark rounded-[24px] p-6 flex items-center justify-between cursor-pointer hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-google-primary/10 dark:bg-google-primary-dark/10 rounded-full text-google-primary dark:text-google-primary-dark">
                        <PieChart className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-google-text dark:text-google-text-dark">仓位占比</div>
                        <div className="text-xs text-google-text-secondary dark:text-google-text-secondary-dark">前十大重仓</div>
                    </div>
                </div>
                <div className="text-xl font-medium text-google-text dark:text-google-text-dark">
                    {valuation?.totalWeight.toFixed(2)}%
                </div>
            </div> */}
        </div>
      </div>

      {/* Holdings List */}
      <div className="bg-white dark:bg-transparent rounded-[24px] border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-google-text-secondary dark:text-google-text-secondary-dark" />
            <h3 className="text-base font-medium text-google-text dark:text-google-text-dark">
                前十大重仓股表现
            </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-[#1E1F20]">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  股票
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  权重
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  现价
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  涨跌
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  贡献
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#131314]">
              {valuation?.holdings.map((item) => {
                const stock = item.realtime;
                const stockChange = stock?.changePercent || 0;
                const isStockUp = stockChange >= 0;
                const contribution = (item.stock.weight * stockChange) / 100;
                
                return (
                  <tr key={item.stock.stockCode} className="hover:bg-gray-50 dark:hover:bg-[#1E1F20] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-google-text dark:text-google-text-dark">{item.stock.stockName}</span>
                        <span className="text-xs text-google-text-secondary dark:text-google-text-secondary-dark font-mono">{item.stock.stockCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-google-text-secondary dark:text-google-text-secondary-dark font-mono">
                      {item.stock.weight}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-google-text dark:text-google-text-dark font-mono font-medium">
                      {stock?.currentPrice.toFixed(2) || '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium font-mono">
                       {stock ? (
                           <span className={isStockUp ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}>
                               {isStockUp ? '+' : ''}{stockChange.toFixed(2)}%
                           </span>
                       ) : (
                           <span className="text-gray-400">--</span>
                       )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-medium">
                        <span className={contribution >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}>
                            {contribution > 0 ? '+' : ''}{contribution.toFixed(4)}%
                        </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        fund={userFundInfo}
        onSuccess={loadUserFundInfo}
      />
      <AddFundModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialFund={info}
        onAdded={loadUserFundInfo}
      />
    </div>
  );
};

export default FundDetail;
