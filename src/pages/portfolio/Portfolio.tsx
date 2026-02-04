import React, { useEffect, useState, useCallback } from 'react';
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
import { useToast } from '@/components/ToastProvider';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Portfolio: React.FC = () => {
  const [portfolio, setPortfolio] = useState<UserPortfolio[]>([]);
  const [valuations, setValuations] = useState<Record<string, FundValuation>>({});
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedFundForTrade, setSelectedFundForTrade] = useState<UserPortfolio | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserPortfolio | null>(null);
  const [editingField, setEditingField] = useState<{ id: string, field: 'holdingAmount' | 'holdingProfit' } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [showValues, setShowValues] = useState(true);
  const [intradayProfitData, setIntradayProfitData] = useState<{ time: string; value: number }[]>([]);
  const [intradayLoading, setIntradayLoading] = useState(false);
  
  const navigate = useNavigate();
  const { currentUser } = useUserStore();
  const { showToast } = useToast();

  const getIntradayStorageKey = (fundCode: string, date: string) => `intraday-${fundCode}-${date}`;
  const getIntradayLatestKey = (fundCode: string) => `intraday-${fundCode}-latest`;
  const getPortfolioIntradayKey = (date: string) => `portfolio-intraday-profit-${date}`;

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

  const clearPortfolioIntradayCache = useCallback(() => {
    const key = getPortfolioIntradayKey(dayjs().format('YYYY-MM-DD'));
    localStorage.removeItem(key);
  }, []);

  const loadPortfolioIntraday = useCallback(async () => {
    if (portfolio.length === 0) {
      setIntradayProfitData([]);
      return;
    }
    setIntradayLoading(true);
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const manualTotal = portfolio.reduce((sum, item) => {
        const isUpToDate = item.isProfitUpToDate && item.updateDate === today;
        if (!isUpToDate) return sum;
        return sum + (item.manualTodayProfit || 0);
      }, 0);

      const totalDayProfitCurrent = portfolio.reduce((sum, item) => {
        const isUpToDate = item.isProfitUpToDate && item.updateDate === today;
        if (isUpToDate) return sum + (item.manualTodayProfit || 0);
        const valuation = valuations[item.fundCode];
        const changePercent = valuation?.changePercent || 0;
        return sum + (item.holdingAmount * (changePercent / 100));
      }, 0);

      if (totalDayProfitCurrent === 0 && manualTotal === 0) {
        setIntradayProfitData([]);
        clearPortfolioIntradayCache();
        return;
      }

      const seriesList = await Promise.all(
        portfolio.map(async (item) => {
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
        })
      );

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

      const times = Array.from(timeMap.keys()).sort();
      if (times.length === 0) {
        if (manualTotal !== 0) {
          const data = [
            { time: '09:30', value: manualTotal },
            { time: '15:00', value: manualTotal }
          ];
          setIntradayProfitData(data);
          savePortfolioIntradayCache(data);
        } else {
          setIntradayProfitData([]);
        }
        return;
      }

      const data = times.map((time) => ({
        time,
        value: (timeMap.get(time) || 0) + manualTotal
      }));
      setIntradayProfitData(data);
      savePortfolioIntradayCache(data);
    } finally {
      setIntradayLoading(false);
    }
  }, [portfolio, valuations, loadIntradayData, saveIntradayData, savePortfolioIntradayCache, clearPortfolioIntradayCache]);

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
          updatedItem = {
            ...updatedItem,
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

  // Fetch valuations
  const fetchValuations = useCallback(async () => {
    if (portfolio.length === 0) return;
    setLoading(true);
    try {
      const promises = portfolio.map(item => getFundValuation(item.fundCode));
      const results = await Promise.all(promises);
      
      const newValuations: Record<string, FundValuation> = {};
      results.forEach(res => {
        if (res) {
          newValuations[res.fundCode] = res;
        }
      });
      setValuations(newValuations);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [portfolio]);

  useEffect(() => {
    if (portfolio.length > 0) {
      fetchValuations();
      const timer = setInterval(fetchValuations, 60000);
      return () => clearInterval(timer);
    }
  }, [portfolio.length, fetchValuations]);

  useEffect(() => {
    if (portfolio.length > 0) {
      const cached = loadPortfolioIntradayCache();
      if (cached.length > 0) {
        setIntradayProfitData(cached);
      }
      void loadPortfolioIntraday();
      const timer = setInterval(() => {
        void loadPortfolioIntraday();
      }, 300000);
      return () => clearInterval(timer);
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
  
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
            <h1 className="text-4xl font-normal text-google-text dark:text-google-text-dark tracking-tight">自选持仓</h1>
            <p className="text-google-text-secondary dark:text-google-text-secondary-dark mt-2 text-lg">
                您的投资概览 {currentUser && `(${currentUser.username})`}
            </p>
        </div>
        <div className="flex space-x-3">
            <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center px-5 py-2.5 bg-google-surface dark:bg-google-surface-dark text-google-text dark:text-google-text-dark rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors"
            >
                <Plus className="h-4 w-4 mr-2" /> 添加基金
            </button>
            <button 
                onClick={() => setShowValues(!showValues)}
                className="p-2.5 bg-google-surface dark:bg-google-surface-dark text-google-text-secondary dark:text-google-text-secondary-dark rounded-full hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors"
                title={showValues ? "隐藏金额" : "显示金额"}
            >
                {showValues ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
            <button 
                onClick={fetchValuations}
                className={`p-2.5 bg-google-surface dark:bg-google-surface-dark text-google-text-secondary dark:text-google-text-secondary-dark rounded-full hover:bg-gray-200 dark:hover:bg-[#2C2D2E] transition-colors ${loading ? 'animate-spin' : ''}`}
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
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-google-surface dark:bg-google-surface-dark p-8 rounded-[24px] col-span-1 md:col-span-3 lg:col-span-1 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-google-text-secondary dark:text-google-text-secondary-dark font-medium mb-2">总资产</div>
                        <div className="text-5xl font-normal text-google-text dark:text-google-text-dark tracking-tight">
                            {showValues ? `¥${totalAsset.toFixed(2)}` : '****'}
                        </div>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-5 dark:opacity-5 transform translate-x-1/4 translate-y-1/4">
                        <Wallet className="h-64 w-64 text-google-primary dark:text-google-primary-dark" />
                    </div>
                </div>

                <div className="bg-google-surface dark:bg-google-surface-dark p-8 rounded-[24px] flex flex-col justify-between">
                     <div className="text-google-text-secondary dark:text-google-text-secondary-dark font-medium mb-1">预估当日盈亏</div>
                     <div className="flex items-center justify-between">
                        <div className={`text-3xl font-normal ${totalDayProfit >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                            {showValues ? `${totalDayProfit > 0 ? '+' : ''}${totalDayProfit.toFixed(2)}` : '****'}
                        </div>
                        {totalDayProfit >= 0 ? (
                            <ArrowUpRight className="h-8 w-8 text-google-red dark:text-google-red-dark opacity-50" />
                        ) : (
                            <ArrowDownRight className="h-8 w-8 text-google-green dark:text-google-green-dark opacity-50" />
                        )}
                     </div>
                </div>

                <div className="bg-google-surface dark:bg-google-surface-dark p-8 rounded-[24px] flex flex-col justify-between">
                     <div className="text-google-text-secondary dark:text-google-text-secondary-dark font-medium mb-1">预估持有盈亏</div>
                     <div className="flex items-center justify-between">
                        <div className={`text-3xl font-normal ${totalRealtimeProfit >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                            {showValues ? `${totalRealtimeProfit > 0 ? '+' : ''}${totalRealtimeProfit.toFixed(2)}` : '****'}
                        </div>
                         {totalRealtimeProfit >= 0 ? (
                            <ArrowUpRight className="h-8 w-8 text-google-red dark:text-google-red-dark opacity-50" />
                        ) : (
                            <ArrowDownRight className="h-8 w-8 text-google-green dark:text-google-green-dark opacity-50" />
                        )}
                     </div>
                </div>
           </div>

          <div className="bg-google-surface dark:bg-google-surface-dark rounded-[24px] p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-google-text-secondary dark:text-google-text-secondary-dark font-medium mb-1">当日盈亏分时</div>
                <div className={`text-2xl font-normal ${isTotalUp ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                  {showValues ? `${totalDayProfit > 0 ? '+' : ''}${totalDayProfit.toFixed(2)}` : '****'}
                </div>
              </div>
              <div className="text-xs text-google-text-secondary dark:text-google-text-secondary-dark">
                {intradayLoading ? '更新中' : (intradayProfitData.length ? `${intradayProfitData.length} 点` : '无分时数据')}
              </div>
            </div>
            <div className="h-40 mt-4 w-full">
              {intradayProfitData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={intradayProfitData}>
                    <defs>
                      <linearGradient id="colorDayProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={strokeColor} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E1F20',
                        borderColor: '#1E1F20',
                        borderRadius: '12px',
                        color: '#fff',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      itemStyle={{ color: '#E3E3E3' }}
                      formatter={(value: number) => [showValues ? value.toFixed(2) : '****', '当日盈亏']}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={strokeColor}
                      fillOpacity={1}
                      fill="url(#colorDayProfit)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-google-text-secondary dark:text-google-text-secondary-dark">
                  暂无分时数据
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-transparent rounded-[24px] border border-gray-200 dark:border-gray-800 overflow-hidden">
             <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-[#1E1F20]">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('fundName')}
                    >
                      <div className="flex items-center">
                        基金名称
                        {renderSortIcon('fundName')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('changePercent')}
                    >
                      <div className="flex items-center justify-end">
                        估值涨跌
                        {renderSortIcon('changePercent')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('dayProfit')}
                    >
                      <div className="flex items-center justify-end">
                        当日盈亏
                        {renderSortIcon('dayProfit')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('holdingAmount')}
                    >
                      <div className="flex items-center justify-end">
                        持仓金额
                        {renderSortIcon('holdingAmount')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider cursor-pointer group"
                      onClick={() => requestSort('holdingProfit')}
                    >
                      <div className="flex items-center justify-end">
                        持有收益
                        {renderSortIcon('holdingProfit')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-google-text-secondary dark:text-google-text-secondary-dark uppercase tracking-wider">操作</th>
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
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col cursor-pointer" onClick={() => navigate(`/fund/${item.fundCode}`)}>
                                <span className="text-base font-medium text-google-text dark:text-google-text-dark group-hover:text-google-primary dark:group-hover:text-google-primary-dark transition-colors">{item.fundName}</span>
                                <span className="text-xs text-google-text-secondary dark:text-google-text-secondary-dark font-mono mt-0.5">{item.fundCode}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium font-mono">
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium font-mono">
                            <div className="flex justify-end">
                                <span className={dayProfit >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}>
                                    {dayProfit > 0 ? '+' : ''}{dayProfit.toFixed(2)}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
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
                        <td className="px-6 py-4 whitespace-nowrap text-right">
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
                                        <span className={`text-sm font-mono ${item.holdingProfit >= 0 ? 'text-google-red dark:text-google-red-dark' : 'text-google-green dark:text-google-green-dark'}`}>
                                            {item.holdingProfit > 0 ? '+' : ''}{item.holdingProfit.toFixed(2)}
                                        </span>
                                        <div className="absolute left-full ml-1.5 flex items-center">
                                            <Edit2 className="h-3.5 w-3.5 text-google-text-secondary opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center space-x-1">
                                <button 
                                    onClick={() => {
                                        setSelectedFundForTrade(item);
                                        setIsTransactionModalOpen(true);
                                    }}
                                    className="text-google-primary dark:text-google-primary-dark hover:bg-google-primary/10 transition-colors p-2 rounded-full"
                                    title="加减仓"
                                >
                                    <ArrowRightLeft className="h-4 w-4" />
                                </button>
                                <button 
                                    onClick={() => openDeleteModal(item)}
                                    className="text-google-text-secondary dark:text-google-text-secondary-dark hover:text-google-red dark:hover:text-google-red-dark transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
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
