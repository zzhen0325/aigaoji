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

const isAnyMarketOpenTime = (time: dayjs.Dayjs) => {
  const minutes = time.hour() * 60 + time.minute();
  const isAOpen = (minutes >= 9 * 60 + 30 && minutes <= 11 * 60 + 30) || (minutes >= 13 * 60 && minutes <= 15 * 60);
  const isHKOpen = (minutes >= 9 * 60 + 30 && minutes <= 12 * 60) || (minutes >= 13 * 60 && minutes <= 16 * 60);
  return isAOpen || isHKOpen;
};

const clampToTradingLabel = (time: dayjs.Dayjs) => {
  const minutes = time.hour() * 60 + time.minute();
  const start = 9 * 60 + 30;
  const end = 15 * 60;
  if (minutes <= start) return '09:30';
  if (minutes >= end) return '15:00';
  return time.format('HH:mm');
};

const parseTimeToMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
};

const getMarketTypeFromTimes = (times: string[]) => {
  const minutes = times.map(parseTimeToMinutes).filter((value): value is number => value !== null);
  const maxMinutes = minutes.length ? Math.max(...minutes) : 0;
  return maxMinutes >= 16 * 60 ? 'HK' : 'A';
};

const getMarketTicks = (marketType: 'A' | 'HK') => (
  marketType === 'HK' ? ['09:30', '12:00', '13:00', '16:00'] : ['09:30', '11:30', '13:00', '15:00']
);

const isTradingTime = (minutes: number, marketType: 'A' | 'HK') => {
  if (marketType === 'HK') {
    return (minutes >= 9 * 60 + 30 && minutes <= 12 * 60) || (minutes >= 13 * 60 && minutes <= 16 * 60);
  }
  return (minutes >= 9 * 60 + 30 && minutes <= 11 * 60 + 30) || (minutes >= 13 * 60 && minutes <= 15 * 60);
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
      const now = dayjs();
      const valuationData = valData ?? (infoData?.netWorth ? {
        fundCode: code,
        estimatedValue: infoData.netWorth,
        previousValue: infoData.netWorth,
        change: 0,
        changePercent: 0,
        calculationTime: now.format('YYYY-MM-DD HH:mm:ss'),
        holdings: [],
        totalWeight: 0
      } : null);
      setInfo(infoData);
      setValuation(valuationData);
      setLastUpdated(now.format('HH:mm:ss'));
      const isNetWorthStale = Boolean(infoData?.netWorthDate && dayjs(infoData.netWorthDate).isBefore(now, 'day'));
      const shouldSkipIntradayCalc = isNetWorthStale && !isMarketOpenTime(now);
      const todayKey = getIntradayBackfillKey(code, now.format('YYYY-MM-DD'));
      const backfillTriggered = Boolean(localStorage.getItem(todayKey));
      if (!shouldSkipIntradayCalc && !isMarketOpenTime(now) && intradayData.length <= 2 && valuationData?.estimatedValue !== undefined && !localStorage.getItem(todayKey)) {
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
      if (!shouldSkipIntradayCalc && valuationData?.estimatedValue !== undefined && isMarketOpenTime(now)) {
        setIntradayData((prev) => {
          const time = now.format('HH:mm');
          const point = { time, value: valuationData.estimatedValue, changePercent: valuationData.changePercent };
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
      } else if (valuationData?.estimatedValue !== undefined && intradayData.length === 0 && !backfillTriggered) {
        const backfilled = await getFundIntradayFromHoldings(code);
        if (backfilled.length >= 30) {
          setIntradayData(backfilled);
          saveIntradayData(code, backfilled);
        } else {
          const baseValue = valuationData.previousValue ?? infoData?.netWorth ?? valuationData.estimatedValue;
          const endTime = clampToTradingLabel(now);
          const seed =
            endTime === '09:30'
              ? [{ time: '09:30', value: baseValue, changePercent: 0 }]
              : [
                  { time: '09:30', value: baseValue, changePercent: 0 },
                  { time: endTime, value: valuationData.estimatedValue, changePercent: valuationData.changePercent }
                ];
          setIntradayData(seed);
          saveIntradayData(code, seed);
        }
        localStorage.setItem(todayKey, '1');
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
    let timer: number | undefined;
    const schedule = () => {
      fetchData(true);
      const nextDelay = isAnyMarketOpenTime(dayjs()) ? 5000 : 60000;
      timer = window.setTimeout(schedule, nextDelay);
    };
    schedule();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
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

  const hasEstimatedValue = Number.isFinite(valuation?.estimatedValue);
  const estimatedValue = hasEstimatedValue ? valuation!.estimatedValue : info.netWorth;
  const changePercent = Number.isFinite(valuation?.changePercent) ? valuation!.changePercent : 0;
  const changeValue = Number.isFinite(valuation?.change) ? valuation!.change : 0;
  const totalWeight = Number.isFinite(valuation?.totalWeight) ? valuation!.totalWeight : 0;
  const holdings = valuation?.holdings || [];
  const formatNumber = (value: number | undefined, digits: number) => (
    Number.isFinite(value) ? value!.toFixed(digits) : '--'
  );
  const isUp = changePercent >= 0;
  // Google Red/Green Semantic Colors
  const ColorClass = isUp ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark';
  const BgClass = isUp ? 'bg-google-red/10 dark:bg-google-red-dark/10' : 'bg-google-green/10 dark:bg-google-green-dark/10';
  const StrokeColor = isUp ? (document.documentElement.classList.contains('dark') ? '#F2B8B5' : '#B3261E') : (document.documentElement.classList.contains('dark') ? '#6DD58C' : '#146C2E');
  const axisTickColor = document.documentElement.classList.contains('dark') ? '#9AA0A6' : '#5F6368';
  const nonZeroIntradayData = intradayData.filter(point => Math.abs(point.value) > 0.000001);
  const baseIntradayData = nonZeroIntradayData.length ? nonZeroIntradayData : intradayData;
  const intradayMarketType = getMarketTypeFromTimes(baseIntradayData.map(point => point.time));
  const intradayAxisTicks = getMarketTicks(intradayMarketType);
  const filteredIntradayData = baseIntradayData.filter(point => {
    const minutes = parseTimeToMinutes(point.time);
    return minutes !== null && isTradingTime(minutes, intradayMarketType);
  });
  const chartIntradayData = filteredIntradayData.length ? filteredIntradayData : baseIntradayData;

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 sm:px-0">
        <div>
           <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-normal text-google-text dark:text-google-text-dark">{info.name}</h1>
                <span className="text-[10px] sm:text-xs bg-google-surface dark:bg-google-surface-dark px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-google-text-secondary dark:text-google-text-secondary-dark font-mono">
                    {info.code}
                </span>
           </div>
           <p className="text-google-text-secondary dark:text-google-text-secondary-dark text-xs sm:text-sm mt-1">
             {info.type} · {info.manager || '未知'}
           </p>
        </div>
        <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto">
            {userFundInfo && (
              <button 
                  onClick={() => setIsTransactionModalOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-6 py-2 bg-google-surface dark:bg-google-surface-dark text-google-primary dark:text-google-primary-dark rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors"
              >
                  <ArrowRightLeft className="h-4 w-4 mr-1.5 sm:mr-2" />
                  交易
              </button>
            )}
            <button 
                onClick={() => userFundInfo ? setIsTransactionModalOpen(true) : setIsAddModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-6 py-2 bg-google-primary dark:bg-google-primary-dark text-white dark:text-google-bg-dark rounded-full text-sm font-medium hover:shadow-md transition-shadow"
            >
                <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
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
        <div className="lg:col-span-2 bg-google-surface dark:bg-google-surface-dark rounded-[24px] p-5 sm:p-6 flex flex-col justify-between min-h-[260px] sm:min-h-[300px]">
            <div>
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-google-text-secondary dark:text-google-text-secondary-dark" />
                    <span className="text-xs sm:text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark">实时估值</span>
                    <span className="text-[10px] sm:text-xs text-google-text-secondary dark:text-google-text-secondary-dark opacity-60">
                        {lastUpdated}
                    </span>
                </div>
                
                <div className="flex items-baseline gap-3 sm:gap-4 mt-2 sm:mt-4">
                    <span className={`text-4xl sm:text-5xl md:text-6xl font-normal tracking-tighter ${ColorClass}`}>
                        {formatNumber(estimatedValue, 4)}
                    </span>
                    <div className={`flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full ${BgClass}`}>
                        {isUp ? <ArrowUp className={`h-3 w-3 sm:h-4 sm:w-4 ${ColorClass}`} /> : <ArrowDown className={`h-3 w-3 sm:h-4 sm:w-4 ${ColorClass}`} />}
                        <span className={`text-sm sm:text-base font-medium ml-1 ${ColorClass}`}>
                            {formatNumber(changePercent, 2)}%
                        </span>
                    </div>
                </div>
                <div className={`mt-1 sm:mt-2 text-base sm:text-lg font-medium ${ColorClass}`}>
                    {changeValue > 0 ? '+' : ''}{formatNumber(changeValue, 4)}
                </div>
            </div>

            {/* Chart Area */}
            <div className="h-32 sm:h-48 mt-4 sm:mt-6 w-full">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartIntradayData} margin={{ left: 16, right: 16, top: 4, bottom: 0 }}>
                    <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={StrokeColor} stopOpacity={0.1}/>
                        <stop offset="95%" stopColor={StrokeColor} stopOpacity={0}/>
                    </linearGradient>
                    </defs>
                    <XAxis 
                        dataKey="time" 
                        ticks={intradayAxisTicks}
                        tick={(props: any) => {
                          const value: string = props?.payload?.value ?? '';
                          const first = intradayAxisTicks[0];
                          const last = intradayAxisTicks[intradayAxisTicks.length - 1];
                          const text = typeof value === 'string' ? value.replace(/^0/, '') : String(value);
                          const isFirst = value === first;
                          const isLast = value === last;
                          const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                          const dx = isFirst ? 4 : isLast ? -4 : 0;
                          return (
                            <text
                              x={props.x}
                              y={props.y}
                              dy={10}
                              dx={dx}
                              textAnchor={textAnchor}
                              fill={axisTickColor}
                              fontSize={10}
                            >
                              {text}
                            </text>
                          );
                        }}
                        tickMargin={8}
                        padding={{ left: 6, right: 6 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        minTickGap={0}
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
        <div className="space-y-4 sm:space-y-6">
            <div className="bg-google-surface dark:bg-google-surface-dark rounded-[24px] p-5 sm:p-6 h-full">
                <div className="flex items-center gap-2 mb-4 sm:mb-6">
                    <Info className="h-4 w-4 sm:h-5 sm:w-5 text-google-text-secondary dark:text-google-text-secondary-dark" />
                    <span className="text-xs sm:text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark">昨日净值</span>
                </div>
                
                <div className="flex flex-col gap-0.5 sm:gap-1">
                    <span className="text-3xl sm:text-4xl font-normal text-google-text dark:text-google-text-dark">
                        {info.netWorth?.toFixed(4)}
                    </span>
                    <span className={`text-base sm:text-lg font-medium ${(parseFloat(info.dayGrowth || '0') >= 0) ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                        {info.dayGrowth && parseFloat(info.dayGrowth) > 0 ? '+' : ''}{info.dayGrowth}%
                    </span>
                    <span className="text-[10px] sm:text-sm text-google-text-secondary dark:text-google-text-secondary-dark mt-1 sm:mt-2">
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
                    {formatNumber(totalWeight, 2)}%
                </div>
            </div> */}
        </div>
      </div>

      <div className="bg-white dark:bg-transparent rounded-[24px] border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-google-text-secondary dark:text-google-text-secondary-dark" />
            <h3 className="text-sm sm:text-base font-medium text-google-text dark:text-google-text-dark">
                前十大重仓股表现
            </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-[#1E1F20]">
              <tr>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  股票
                </th>
                <th scope="col" className="hidden sm:table-cell px-3 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  权重
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  现价
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  涨跌
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-right text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">
                  贡献
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#131314]">
              {holdings.length > 0 ? holdings.map((item) => {
                const stock = item.realtime;
                const stockChange = stock?.changePercent || 0;
                const isStockUp = stockChange >= 0;
                const contribution = (item.stock.weight * stockChange) / 100;
                
                return (
                  <tr key={item.stock.stockCode} className="hover:bg-gray-50 dark:hover:bg-[#1E1F20] transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-medium text-google-text dark:text-google-text-dark">{item.stock.stockName}</span>
                        <span className="text-[10px] sm:text-xs text-google-text-secondary dark:text-google-text-secondary-dark font-mono">{item.stock.stockCode}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm text-google-text-secondary dark:text-google-text-secondary-dark font-mono">
                      {item.stock.weight}%
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm text-google-text dark:text-google-text-dark font-mono font-medium">
                      {formatNumber(stock?.currentPrice, 2)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium font-mono">
                       {stock ? (
                           <span className={isStockUp ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}>
                               {isStockUp ? '+' : ''}{stockChange.toFixed(2)}%
                           </span>
                       ) : (
                           <span className="text-gray-400">--</span>
                       )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-mono font-medium">
                        <span className={contribution >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}>
                            {contribution > 0 ? '+' : ''}{contribution.toFixed(4)}%
                        </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-6 text-center text-xs sm:text-sm text-google-text-secondary dark:text-google-text-secondary-dark">
                    暂无重仓股数据
                  </td>
                </tr>
              )}
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
