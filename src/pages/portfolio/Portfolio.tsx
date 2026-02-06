import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPortfolio, FundValuation } from '@/types';
import { getFundIntradayFromHoldings, getFundValuation } from '@/api/fund';
import { Trash2, RefreshCw, Plus, Wallet, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Edit2, ChevronUp, ChevronDown, ChevronsUpDown, Eye, EyeOff } from 'lucide-react';
import { useUserStore, getPortfolioKey } from '@/store/userStore';
import { getUserPortfolio, saveUserPortfolio } from '@/api/portfolio';
import { AddFundModal } from '@/components/AddFundModal';
import { TransactionModal } from '@/components/TransactionModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import dayjs from 'dayjs';
import { useToast } from '@/hooks/useToast';
import IntradayProfitChart from '@/components/IntradayProfitChart';

const PORTFOLIO_CACHE_TTL = 2 * 60 * 1000;
const FUND_VALUATION_CONCURRENCY = 4;
const INTRADAY_BACKFILL_CONCURRENCY = 5;

const runWithConcurrency = async <T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = new Array(workerCount).fill(null).map(async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await task(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
};

const getPortfolioCacheKey = (username?: string) => `portfolio-page-cache-${username ?? 'guest'}`;

const isAnyMarketOpenTime = (time: dayjs.Dayjs) => {
  const minutes = time.hour() * 60 + time.minute();
  const isAOpen = (minutes >= 9 * 60 + 30 && minutes <= 11 * 60 + 30) || (minutes >= 13 * 60 && minutes <= 15 * 60);
  const isHKOpen = (minutes >= 9 * 60 + 30 && minutes <= 12 * 60) || (minutes >= 13 * 60 && minutes <= 16 * 60);
  return isAOpen || isHKOpen;
};

const loadPortfolioPageCache = (username?: string) => {
  try {
    const raw = sessionStorage.getItem(getPortfolioCacheKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp) return null;
    if (Date.now() - parsed.timestamp > PORTFOLIO_CACHE_TTL) return null;
    if (!Array.isArray(parsed.portfolio)) return null;
    return parsed;
  } catch (e) {
    console.error('Failed to load portfolio cache', e);
    return null;
  }
};

const savePortfolioPageCache = (
  username: string | undefined,
  data: {
    portfolio: UserPortfolio[];
    valuations: Record<string, FundValuation>;
    intradayProfitData: { time: string; value: number }[];
  }
) => {
  try {
    sessionStorage.setItem(
      getPortfolioCacheKey(username),
      JSON.stringify({ ...data, timestamp: Date.now() })
    );
  } catch (e) {
    console.error('Failed to save portfolio cache', e);
  }
};

const Portfolio: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useUserStore();
  const { showToast } = useToast();

  const initialCache = loadPortfolioPageCache(currentUser?.username);

  const [portfolio, setPortfolio] = useState<UserPortfolio[]>(() => initialCache?.portfolio || []);
  const [valuations, setValuations] = useState<Record<string, FundValuation>>(() => initialCache?.valuations || {});
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedFundForTrade, setSelectedFundForTrade] = useState<UserPortfolio | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserPortfolio | null>(null);
  const [editingField, setEditingField] = useState<{ id: string, field: 'holdingAmount' | 'holdingProfit' } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [showValues, setShowValues] = useState(true);
  const [intradayProfitData, setIntradayProfitData] = useState<{ time: string; value: number }[]>(() => initialCache?.intradayProfitData || []);
  const [intradayLoading, setIntradayLoading] = useState(false);
  const valuationRequestId = useRef(0);

  const getIntradayStorageKey = (fundCode: string, date: string) => `intraday-${fundCode}-${date}`;
  const getIntradayLatestKey = (fundCode: string) => `intraday-${fundCode}-latest`;
  const getPortfolioIntradayKey = (date: string) => `portfolio-intraday-profit-${date}`;

  useEffect(() => {
    const cache = loadPortfolioPageCache(currentUser?.username);
    if (!cache) return;
    setPortfolio(cache.portfolio);
    setValuations(cache.valuations || {});
    setIntradayProfitData(cache.intradayProfitData || []);
  }, [currentUser?.username]);

  useEffect(() => {
    savePortfolioPageCache(currentUser?.username, {
      portfolio,
      valuations,
      intradayProfitData
    });
  }, [currentUser?.username, portfolio, valuations, intradayProfitData]);

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

  const loadPortfolioIntradayCache = useCallback(() => {
    const key = getPortfolioIntradayKey(dayjs().format('YYYY-MM-DD'));
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse portfolio intraday data', e);
      return [];
    }
  }, []);

  const savePortfolioIntradayCache = useCallback((data: { time: string; value: number }[]) => {
    const key = getPortfolioIntradayKey(dayjs().format('YYYY-MM-DD'));
    localStorage.setItem(key, JSON.stringify(data));
  }, []);

  const loadPortfolioIntraday = useCallback(async () => {
    if (portfolio.length === 0) {
      setIntradayProfitData([]);
      return;
    }

    const parseTimeToMinutes = (time: string) => {
      const [hour, minute] = time.split(':').map(Number);
      if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
      return hour * 60 + minute;
    };

    const now = dayjs();
    const today = now.format('YYYY-MM-DD');
    const marketOpen = isAnyMarketOpenTime(now);

    const manualTotal = portfolio.reduce((sum, item) => {
      const isUpToDate = item.isProfitUpToDate && item.updateDate === today;
      if (!isUpToDate) return sum;
      return sum + (item.manualTodayProfit || 0);
    }, 0);

    const cachedPortfolioIntraday = loadPortfolioIntradayCache();
    if (!marketOpen && cachedPortfolioIntraday.length > 0) {
      setIntradayProfitData(cachedPortfolioIntraday);
      return;
    }

    setIntradayLoading(true);

    try {
      const seriesList = await runWithConcurrency(portfolio, INTRADAY_BACKFILL_CONCURRENCY, async (item) => {
        const isUpToDate = item.isProfitUpToDate && item.updateDate === today;
        if (isUpToDate) return [];
        const cached = loadIntradayData(item.fundCode);
        if (cached.length > 0) return cached;
        const fetched = await getFundIntradayFromHoldings(item.fundCode);
        if (fetched.length > 0) {
          saveIntradayData(item.fundCode, fetched);
          return fetched;
        }
        return [];
      });

      const timeMap = new Map<string, number>();
      seriesList.forEach((series, index) => {
        const item = portfolio[index];
        const isUpToDate = item.isProfitUpToDate && item.updateDate === today;
        if (isUpToDate) return;
        series.forEach((point: { time: string; changePercent: number }) => {
          const profit = item.holdingAmount * (point.changePercent / 100);
          const existing = timeMap.get(point.time) || 0;
          timeMap.set(point.time, existing + profit);
        });
      });

      const times = Array.from(timeMap.keys()).sort((a, b) => {
        const aMinutes = parseTimeToMinutes(a) ?? 0;
        const bMinutes = parseTimeToMinutes(b) ?? 0;
        return aMinutes - bMinutes;
      });

      if (times.length === 0) {
        const data = manualTotal !== 0
          ? [
              { time: '09:30', value: manualTotal },
              { time: '15:00', value: manualTotal }
            ]
          : [];
        setIntradayProfitData(data);
        if (data.length > 0) savePortfolioIntradayCache(data);
        return;
      }

      const data = times.map((time) => ({
        time,
        value: (timeMap.get(time) || 0) + manualTotal
      }));
      setIntradayProfitData(data);
      if (data.length > 0) savePortfolioIntradayCache(data);
    } catch (error) {
      console.error('Failed to load portfolio intraday', error);
    } finally {
      setIntradayLoading(false);
    }
  }, [portfolio, loadIntradayData, saveIntradayData, savePortfolioIntradayCache, loadPortfolioIntradayCache]);

  const loadData = useCallback(async () => {
    if (currentUser) {
      // Logged in: load from JSON persistence
      const stored = localStorage.getItem('all_portfolios');
      if (stored) {
        const all = JSON.parse(stored) as Record<string, UserPortfolio[]>;
        if (Array.isArray(all[currentUser.username])) {
          setPortfolio(all[currentUser.username]);
        }
      }

      let data = await getUserPortfolio(currentUser.username);
      
      // Reconciliation logic
      const today = dayjs().format('YYYY-MM-DD');
      let needsSave = false;
      
      const reconciledData = data.map(item => {
        let hasChanges = false;
        let updatedItem = { ...item };

        // 1. Transaction Reconciliation
        if (item.transactions && item.transactions.length > 0) {
          const pending = item.transactions.filter(t => !t.isReconciled);
          if (pending.length > 0) {
            let newHoldingAmount = item.holdingAmount;
            const newHoldingProfit = item.holdingProfit;
            let updatedTransactions = [...item.transactions];

            updatedTransactions = updatedTransactions.map(t => {
              if (!t.isReconciled && dayjs(today).isAfter(t.effectiveDate)) {
                if (t.type === 'buy') {
                  newHoldingAmount += t.amount;
                } else {
                  newHoldingAmount -= t.amount;
                }
                hasChanges = true;
                return { ...t, isReconciled: true };
              }
              return t;
            });

            if (hasChanges) {
              updatedItem = {
                ...updatedItem,
                holdingAmount: newHoldingAmount,
                holdingProfit: newHoldingProfit,
                transactions: updatedTransactions
              };
            }
          }
        }

        // 2. Profit Update Rollover
        if (item.isProfitUpToDate && item.updateDate !== today) {
          const dayProfit = item.manualTodayProfit || 0;
          updatedItem = {
            ...updatedItem,
            holdingProfit: updatedItem.holdingProfit + dayProfit,
            isProfitUpToDate: false,
            manualTodayProfit: 0,
            updateDate: today
          };
          hasChanges = true;
        }

        if (hasChanges) {
          needsSave = true;
          return updatedItem;
        }
        return item;
      });

      if (needsSave) {
        void saveUserPortfolio(currentUser.username, reconciledData);
        data = reconciledData;
      }
      
      setPortfolio(data);
    } else {
      // Guest: load from LocalStorage
      const key = getPortfolioKey();
      const saved = localStorage.getItem(key);
      if (saved) {
        setPortfolio(JSON.parse(saved));
      } else {
        setPortfolio([]);
      }
    }
  }, [currentUser]);

  // Load portfolio from local storage based on user
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (portfolio.length === 0) return;
    const today = dayjs().format('YYYY-MM-DD');
    let hasChanges = false;
    const updated = portfolio.map(item => {
      if (!item.updateDate || item.updateDate === today) return item;
      if (item.isProfitUpToDate) {
        const dayProfit = item.manualTodayProfit || 0;
        hasChanges = true;
        return {
          ...item,
          holdingProfit: item.holdingProfit + dayProfit,
          isProfitUpToDate: false,
          manualTodayProfit: 0,
          updateDate: today
        };
      }
      const valuation = valuations[item.fundCode];
      if (!valuation) return item;
      const dayProfit = item.holdingAmount * (valuation.changePercent / 100);
      hasChanges = true;
      return {
        ...item,
        holdingAmount: item.holdingAmount + dayProfit,
        holdingProfit: item.holdingProfit + dayProfit,
        isProfitUpToDate: false,
        manualTodayProfit: 0,
        updateDate: today
      };
    });
    if (!hasChanges) return;
    setPortfolio(updated);
    if (currentUser) {
      void saveUserPortfolio(currentUser.username, updated);
    } else {
      const key = getPortfolioKey();
      localStorage.setItem(key, JSON.stringify(updated));
    }
  }, [portfolio, valuations, currentUser]);

  // Fetch valuations
  const fetchValuations = useCallback(async () => {
    if (portfolio.length === 0) return;
    const requestId = (valuationRequestId.current += 1);
    setLoading(true);
    try {
      let nextIndex = 0;
      const workerCount = Math.min(FUND_VALUATION_CONCURRENCY, portfolio.length);
      const workers = new Array(workerCount).fill(null).map(async () => {
        while (nextIndex < portfolio.length) {
          const current = nextIndex;
          nextIndex += 1;
          const item = portfolio[current];
          const result = await getFundValuation(item.fundCode);
          if (!result) continue;
          if (requestId !== valuationRequestId.current) return;
          setValuations(prev => ({
            ...prev,
            [result.fundCode]: result
          }));
        }
      });
      await Promise.all(workers);
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === valuationRequestId.current) {
        setLoading(false);
      }
    }
  }, [portfolio]);

  useEffect(() => {
    if (portfolio.length > 0) {
      let timer: number | undefined;
      const schedule = () => {
        fetchValuations();
        const nextDelay = isAnyMarketOpenTime(dayjs()) ? 5000 : 60000;
        timer = window.setTimeout(schedule, nextDelay);
      };
      schedule();
      return () => {
        if (timer) window.clearTimeout(timer);
      };
    }
  }, [portfolio.length, fetchValuations]);

  useEffect(() => {
    if (portfolio.length > 0) {
      const cached = loadPortfolioIntradayCache();
      if (cached.length > 0) {
        setIntradayProfitData(cached);
      }
      let timer: number | undefined;
      const schedule = () => {
        void loadPortfolioIntraday();
        const nextDelay = isAnyMarketOpenTime(dayjs()) ? 15000 : 60000;
        timer = window.setTimeout(schedule, nextDelay);
      };
      schedule();
      return () => {
        if (timer) window.clearTimeout(timer);
      };
    }
    setIntradayProfitData([]);
  }, [portfolio.length, loadPortfolioIntraday, loadPortfolioIntradayCache]);

  const updateItem = async (id: string, field: 'holdingAmount' | 'holdingProfit', value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      showToast('请输入有效的数字', 'error');
      return;
    }
    
    const newPortfolio = portfolio.map(item => {
      if (item.id === id) {
        return { ...item, [field]: numValue };
      }
      return item;
    });
    setPortfolio(newPortfolio);
    
    try {
      if (currentUser) {
        await saveUserPortfolio(currentUser.username, newPortfolio);
      } else {
        const key = getPortfolioKey();
        localStorage.setItem(key, JSON.stringify(newPortfolio));
      }
      showToast('更新成功', 'success');
    } catch (error) {
      console.error(error);
      showToast('更新失败，请重试', 'error');
    }
  };

  const openDeleteModal = (item: UserPortfolio) => {
    setPendingDelete(item);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    const newPortfolio = portfolio.filter(item => item.id !== id);
    setPortfolio(newPortfolio);
    try {
      if (currentUser) {
        await saveUserPortfolio(currentUser.username, newPortfolio);
      } else {
        const key = getPortfolioKey();
        localStorage.setItem(key, JSON.stringify(newPortfolio));
      }
      showToast('删除成功', 'success');
      closeDeleteModal();
    } catch (error) {
      console.error(error);
      showToast('删除失败，请重试', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, field: 'holdingAmount' | 'holdingProfit', value: string) => {
    if (e.key === 'Enter') {
      updateItem(id, field, value);
      setEditingField(null);
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'desc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'desc') direction = 'asc';
      else if (sortConfig.direction === 'asc') direction = null;
    }
    setSortConfig({ key, direction });
  };

  const sortedPortfolio = React.useMemo(() => {
    const sortableItems = [...portfolio];
    if (sortConfig.key !== '' && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        const getCalculatedValues = (item: UserPortfolio) => {
          const valuation = valuations[item.fundCode];
          const changePercent = valuation?.changePercent || 0;
          const today = dayjs().format('YYYY-MM-DD');
          const isUpToDate = item.isProfitUpToDate && item.updateDate === today;
          const dayProfit = isUpToDate ? (item.manualTodayProfit || 0) : (item.holdingAmount * (changePercent / 100));
          return { changePercent, dayProfit };
        };

        switch (sortConfig.key) {
          case 'fundName':
            aValue = a.fundName;
            bValue = b.fundName;
            break;
          case 'changePercent':
            aValue = getCalculatedValues(a).changePercent;
            bValue = getCalculatedValues(b).changePercent;
            break;
          case 'dayProfit':
            aValue = getCalculatedValues(a).dayProfit;
            bValue = getCalculatedValues(b).dayProfit;
            break;
          case 'holdingAmount':
            aValue = a.holdingAmount;
            bValue = b.holdingAmount;
            break;
          case 'holdingProfit':
            aValue = a.holdingProfit;
            bValue = b.holdingProfit;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [portfolio, valuations, sortConfig]);

  // Calculate totals
  let totalAsset = 0;
  let totalDayProfit = 0;
  let totalRealtimeProfit = 0; // Accumulated + Day Change
  
  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ChevronUp className="ml-1 h-3 w-3 text-google-primary dark:text-google-primary-dark" />;
    }
    if (sortConfig.direction === 'desc') {
      return <ChevronDown className="ml-1 h-3 w-3 text-google-primary dark:text-google-primary-dark" />;
    }
    return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />;
  };

  portfolio.forEach(item => {
    const valuation = valuations[item.fundCode];
    const changePercent = valuation?.changePercent || 0;
    
    const today = dayjs().format('YYYY-MM-DD');
    const isUpToDate = item.isProfitUpToDate && item.updateDate === today;

    // Core Calculation Logic
    let currentVal: number;
    let dayProfit: number;
    let totalProfit: number;

    if (isUpToDate) {
      // If user provided today's profit manually, holdingAmount and holdingProfit are already final for today.
      currentVal = item.holdingAmount;
      dayProfit = item.manualTodayProfit || 0;
      totalProfit = item.holdingProfit;
    } else {
      // Normal real-time calculation: yesterday's base + today's estimated change
      dayProfit = item.holdingAmount * (changePercent / 100);
      currentVal = item.holdingAmount + dayProfit;
      totalProfit = item.holdingProfit + dayProfit;
    }
    
    // Adjust for pending transactions (not yet merged into base)
    const pendingBuyAmount = (item.transactions || [])
      .filter(t => !t.isReconciled && t.type === 'buy')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const pendingSellAmount = (item.transactions || [])
      .filter(t => !t.isReconciled && t.type === 'sell')
      .reduce((sum, t) => sum + t.amount, 0);

    currentVal += (pendingBuyAmount - pendingSellAmount);
    
    totalAsset += currentVal;
    totalDayProfit += dayProfit;
    totalRealtimeProfit += totalProfit;
  });

  const isTotalUp = totalDayProfit >= 0;
  const strokeColor = isTotalUp
    ? (document.documentElement.classList.contains('dark') ? '#F2B8B5' : '#B3261E')
    : (document.documentElement.classList.contains('dark') ? '#6DD58C' : '#146C2E');
  const axisTickColor = document.documentElement.classList.contains('dark') ? '#9AA0A6' : '#5F6368';
  const totalAssetBase = totalAsset - totalDayProfit;
  const totalDayProfitPercent = totalAssetBase !== 0 ? (totalDayProfit / totalAssetBase) * 100 : 0;
  const totalAssetBaseForHolding = totalAsset - totalRealtimeProfit;
  const totalRealtimeProfitPercent = totalAssetBaseForHolding !== 0 ? (totalRealtimeProfit / totalAssetBaseForHolding) * 100 : 0;
  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const dayProfitPercentLabel = showValues ? formatPercent(totalDayProfitPercent) : '****';
  const realtimeProfitPercentLabel = showValues ? formatPercent(totalRealtimeProfitPercent) : '****';
  const normalizedIntradayProfitData = intradayProfitData
    .map(point => ({
      time: point.time,
      value: typeof point.value === 'number' ? point.value : parseFloat(String(point.value))
    }))
    .filter(point => Number.isFinite(point.value));
  
  const chartIntradayProfitData = React.useMemo(() => {
    const parseTimeToMinutes = (time: string) => {
      const [hour, minute] = time.split(':').map(Number);
      if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
      return hour * 60 + minute;
    };
    if (normalizedIntradayProfitData.length === 0) return [];
    return [...normalizedIntradayProfitData].sort((a, b) => {
      const aMinutes = parseTimeToMinutes(a.time) ?? 0;
      const bMinutes = parseTimeToMinutes(b.time) ?? 0;
      return aMinutes - bMinutes;
    });
  }, [normalizedIntradayProfitData]);
  
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-1 sm:px-0">
        <div>
            <h1 className="text-3xl sm:text-4xl font-normal text-google-text dark:text-google-text-dark tracking-tight">自选持仓</h1>
            <p className="text-google-text-secondary dark:text-google-text-secondary-dark mt-1 text-base sm:text-lg">
                您的投资概览 {currentUser && `(${currentUser.username})`}
            </p>
        </div>
        <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto">
            <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-5 py-2 sm:py-2.5 bg-google-surface dark:bg-google-surface-dark text-google-text dark:text-google-text-dark rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors"
            >
                <Plus className="h-4 w-4 mr-1.5 sm:mr-2" /> 添加基金
            </button>
            <button 
                onClick={() => setShowValues(!showValues)}
                className="p-2 sm:p-2.5 bg-google-surface dark:bg-google-surface-dark text-google-text-secondary dark:text-google-text-secondary-dark rounded-full hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors"
                title={showValues ? "隐藏金额" : "显示金额"}
            >
                {showValues ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
            <button 
                onClick={fetchValuations}
                className={`p-2 sm:p-2.5 bg-google-surface dark:bg-google-surface-dark text-google-text-secondary dark:text-google-text-secondary-dark rounded-full hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors ${loading ? 'animate-spin' : ''}`}
            >
                <RefreshCw className="h-5 w-5" />
            </button>
        </div>
      </div>

      {portfolio.length === 0 ? (
        <div className="text-center py-24 bg-google-surface dark:bg-google-surface-dark rounded-[24px] border border-transparent">
          <div className="w-16 h-16 bg-google-primary/10 dark:bg-google-primary-dark/10 rounded-full flex items-center justify-center mx-auto mb-4 text-google-primary dark:text-google-primary-dark">
            <Wallet className="h-8 w-8" />
          </div>
          <p className="text-google-text-secondary dark:text-google-text-secondary-dark mb-8 text-lg">暂无持仓数据</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-8 py-3 bg-google-primary dark:bg-google-primary-dark text-white dark:text-google-bg-dark rounded-full hover:opacity-90 font-medium transition-all shadow-md hover:shadow-lg"
          >
            去添加
          </button>
        </div>
      ) : (
        <div className="space-y-8">
           {/* Dashboard Cards */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-google-surface dark:bg-google-surface-dark p-5 sm:p-8 rounded-[24px] col-span-1 md:col-span-3 lg:col-span-1 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-google-text-secondary dark:text-google-text-secondary-dark font-medium mb-1 sm:mb-2 text-sm sm:text-base">总资产</div>
                        <div className="text-3xl sm:text-4xl md:text-5xl font-normal text-google-text dark:text-google-text-dark tracking-tight">
                            {showValues ? `¥${totalAsset.toFixed(2)}` : '****'}
                        </div>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-5 dark:opacity-5 transform translate-x-1/4 translate-y-1/4">
                        <Wallet className="h-48 w-48 sm:h-64 sm:w-64 text-google-primary dark:text-google-primary-dark" />
                    </div>
                </div>

                <div className="bg-google-surface dark:bg-google-surface-dark p-5 sm:p-8 rounded-[24px] flex flex-col justify-between">
                     <div className="text-google-text-secondary dark:text-google-text-secondary-dark font-medium mb-1 text-sm sm:text-base">当日盈亏</div>
                     <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl sm:text-3xl font-normal ${totalDayProfit >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                              {showValues ? `${totalDayProfit > 0 ? '+' : ''}${totalDayProfit.toFixed(2)}` : '****'}
                          </div>
                          <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${totalDayProfit >= 0 ? 'bg-google-red/10 dark:bg-google-red-dark/10 text-google-red dark:text-google-red-dark' : 'bg-google-green/10 dark:bg-google-green-dark/10 text-google-green dark:text-google-green-dark'}`}>
                            {dayProfitPercentLabel}
                          </span>
                        </div>
                        {totalDayProfit >= 0 ? (
                            <ArrowUpRight className="h-6 w-6 sm:h-8 sm:w-8 text-google-red dark:text-google-red-dark opacity-50" />
                        ) : (
                            <ArrowDownRight className="h-6 w-6 sm:h-8 sm:w-8 text-google-green dark:text-google-green-dark opacity-50" />
                        )}
                     </div>
                </div>

                <div className="bg-google-surface dark:bg-google-surface-dark p-5 sm:p-8 rounded-[24px] flex flex-col justify-between">
                     <div className="text-google-text-secondary dark:text-google-text-secondary-dark font-medium mb-1 text-sm sm:text-base">持有盈亏</div>
                     <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl sm:text-3xl font-normal ${totalRealtimeProfit >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                              {showValues ? `${totalRealtimeProfit > 0 ? '+' : ''}${totalRealtimeProfit.toFixed(2)}` : '****'}
                          </div>
                          <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${totalRealtimeProfit >= 0 ? 'bg-google-red/10 dark:bg-google-red-dark/10 text-google-red dark:text-google-red-dark' : 'bg-google-green/10 dark:bg-google-green-dark/10 text-google-green dark:text-google-green-dark'}`}>
                            {realtimeProfitPercentLabel}
                          </span>
                        </div>
                         {totalRealtimeProfit >= 0 ? (
                            <ArrowUpRight className="h-6 w-6 sm:h-8 sm:w-8 text-google-red dark:text-google-red-dark opacity-50" />
                        ) : (
                            <ArrowDownRight className="h-6 w-6 sm:h-8 sm:w-8 text-google-green dark:text-google-green-dark opacity-50" />
                        )}
                     </div>
                </div>
           </div>

          <div className="bg-google-surface dark:bg-google-surface-dark rounded-[24px] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-google-text-secondary dark:text-google-text-secondary-dark font-medium mb-1 text-sm sm:text-base">当日盈亏分时</div>
                <div className={`text-xl sm:text-2xl font-normal ${isTotalUp ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                  {showValues ? `${totalDayProfit > 0 ? '+' : ''}${totalDayProfit.toFixed(2)}` : '****'}
                </div>
              </div>
              <div className={`text-[10px] sm:text-xs ${isTotalUp ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                {intradayLoading ? '更新中' : dayProfitPercentLabel}
              </div>
            </div>
            <div className="h-32 sm:h-40 mt-4 w-full">
              <IntradayProfitChart
                data={chartIntradayProfitData}
                strokeColor={strokeColor}
                axisTickColor={axisTickColor}
                showValues={showValues}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-transparent rounded-[24px] border border-gray-200 dark:border-gray-800 overflow-hidden">
             <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-[#1E1F20]">
                  <tr>
                    <th 
                      className="px-3 sm:px-6 py-4 text-left text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('fundName')}
                    >
                      <div className="flex items-center">
                        基金名称
                        {renderSortIcon('fundName')}
                      </div>
                    </th>
                    <th 
                      className="px-3 sm:px-6 py-4 text-right text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('changePercent')}
                    >
                      <div className="flex items-center justify-end">
                        估值涨跌
                        {renderSortIcon('changePercent')}
                      </div>
                    </th>
                    <th 
                      className="px-3 sm:px-6 py-4 text-right text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('dayProfit')}
                    >
                      <div className="flex items-center justify-end">
                        当日盈亏
                        {renderSortIcon('dayProfit')}
                      </div>
                    </th>
                    <th 
                      className="hidden md:table-cell px-3 sm:px-6 py-4 text-right text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('holdingAmount')}
                    >
                      <div className="flex items-center justify-end">
                        持仓金额
                        {renderSortIcon('holdingAmount')}
                      </div>
                    </th>
                    <th 
                      className="px-3 sm:px-6 py-4 text-right text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('holdingProfit')}
                    >
                      <div className="flex items-center justify-end">
                        持有收益
                        {renderSortIcon('holdingProfit')}
                      </div>
                    </th>
                    <th className="px-3 sm:px-6 py-4 text-center text-[10px] sm:text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#131314]">
                  {sortedPortfolio.map(item => {
                    const valuation = valuations[item.fundCode];
                    const changePercent = valuation?.changePercent || 0;
                    const isUp = changePercent >= 0;
                    
                    const today = dayjs().format('YYYY-MM-DD');
                    const isUpToDate = item.isProfitUpToDate && item.updateDate === today;
                    const dayProfit = isUpToDate ? (item.manualTodayProfit || 0) : (item.holdingAmount * (changePercent / 100));
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-[#1E1F20] transition-colors group">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col cursor-pointer" onClick={() => navigate(`/fund/${item.fundCode}`)}>
                                <span className="text-sm sm:text-base font-medium text-google-text dark:text-google-text-dark group-hover:text-google-primary dark:group-hover:text-google-primary-dark transition-colors">{item.fundName}</span>
                                <span className="text-[10px] sm:text-xs text-google-text-secondary dark:text-google-text-secondary-dark font-mono mt-0.5">{item.fundCode}</span>
                            </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium font-mono">
                            <div className="flex justify-end">
                                {valuation ? (
                                    <span className={isUp ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}>
                                        {isUp ? '+' : ''}{changePercent.toFixed(2)}%
                                    </span>
                                ) : (
                                    <span className="text-gray-400">--</span>
                                )}
                            </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium font-mono">
                            <div className="flex justify-end">
                                <span className={dayProfit >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}>
                                    {dayProfit > 0 ? '+' : ''}{dayProfit.toFixed(2)}
                                </span>
                            </div>
                        </td>
                        <td className="hidden md:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end items-center group/cell min-h-[32px]">
                                {editingField?.id === item.id && editingField?.field === 'holdingAmount' ? (
                                    <input 
                                        type="number" 
                                        autoFocus
                                        className="w-full max-w-[100px] text-right bg-transparent border-b border-google-primary dark:border-google-primary-dark focus:outline-none text-sm text-google-text dark:text-google-text-dark font-mono transition-colors"
                                        defaultValue={item.holdingAmount}
                                        onBlur={(e) => {
                                            updateItem(item.id, 'holdingAmount', e.target.value);
                                            setEditingField(null);
                                        }}
                                        onKeyDown={(e) => handleKeyDown(e, item.id, 'holdingAmount', (e.target as HTMLInputElement).value)}
                                    />
                                ) : (
                                    <div 
                                        className="relative flex items-center cursor-pointer"
                                        onClick={() => setEditingField({ id: item.id, field: 'holdingAmount' })}
                                    >
                                        <span className="text-sm text-google-text dark:text-google-text-dark font-mono">
                                            {item.holdingAmount.toFixed(2)}
                                        </span>
                                        <div className="absolute left-full ml-1.5 flex items-center">
                                            <Edit2 className="h-3.5 w-3.5 text-google-text-secondary opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end items-center group/cell min-h-[32px]">
                                {editingField?.id === item.id && editingField?.field === 'holdingProfit' ? (
                                    <input 
                                        type="number" 
                                        autoFocus
                                        className="w-full max-w-[100px] text-right bg-transparent border-b border-google-primary dark:border-google-primary-dark focus:outline-none text-sm text-google-text dark:text-google-text-dark font-mono transition-colors"
                                        defaultValue={item.holdingProfit}
                                        onBlur={(e) => {
                                            updateItem(item.id, 'holdingProfit', e.target.value);
                                            setEditingField(null);
                                        }}
                                        onKeyDown={(e) => handleKeyDown(e, item.id, 'holdingProfit', (e.target as HTMLInputElement).value)}
                                    />
                                ) : (
                                    <div 
                                        className="relative flex items-center cursor-pointer"
                                        onClick={() => setEditingField({ id: item.id, field: 'holdingProfit' })}
                                    >
                                        <span className={`text-xs sm:text-sm font-mono ${item.holdingProfit >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                                            {item.holdingProfit > 0 ? '+' : ''}{item.holdingProfit.toFixed(2)}
                                        </span>
                                        <div className="absolute left-full ml-1.5 flex items-center">
                                            <Edit2 className="h-3.5 w-3.5 text-google-text-secondary opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-0.5 sm:space-x-1">
                                <button 
                                    onClick={() => {
                                        setSelectedFundForTrade(item);
                                        setIsTransactionModalOpen(true);
                                    }}
                                    className="text-google-primary dark:text-google-primary-dark hover:bg-google-primary/10 transition-colors p-1.5 sm:p-2 rounded-full"
                                    title="加减仓"
                                >
                                    <ArrowRightLeft className="h-4 w-4" />
                                </button>
                                <button 
                                    onClick={() => openDeleteModal(item)}
                                    className="text-google-text-secondary dark:text-google-text-secondary-dark hover:text-google-red dark:hover:text-google-red-dark transition-colors p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                    title="删除"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <AddFundModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdded={loadData}
      />
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        fund={selectedFundForTrade}
        onSuccess={loadData}
      />
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="删除该基金"
        description={pendingDelete ? `将移除 ${pendingDelete.fundName} (${pendingDelete.fundCode}) 的持仓记录` : ''}
        confirmText="删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
};

export default Portfolio;
