import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Wallet, TrendingUp, Check, AlertCircle } from 'lucide-react';
import { searchFunds } from '@/api/fund';
import { FundInfo, UserPortfolio } from '@/types';
import { useUserStore, getPortfolioKey } from '@/store/userStore';
import { getUserPortfolio, saveUserPortfolio } from '@/api/portfolio';
import dayjs from 'dayjs';

interface AddFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  initialFund?: FundInfo | null;
}

export const AddFundModal: React.FC<AddFundModalProps> = ({ isOpen, onClose, onAdded, initialFund }) => {
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<FundInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundInfo | null>(null);
  
  const [holdingAmount, setHoldingAmount] = useState('');
  const [holdingProfit, setHoldingProfit] = useState('');
  const [todayProfitInput, setTodayProfitInput] = useState('');
  
  const { currentUser } = useUserStore();

  useEffect(() => {
    if (!isOpen) {
      setKeyword('');
      setSearchResults([]);
      setSelectedFund(null);
      setHoldingAmount('');
      setHoldingProfit('');
      setTodayProfitInput('');
    } else if (initialFund) {
      setSelectedFund(initialFund);
    }
  }, [isOpen, initialFund]);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    try {
      const data = await searchFunds(keyword);
      setSearchResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedFund) return;

    const amount = parseFloat(holdingAmount) || 0;
    const baseProfit = parseFloat(holdingProfit) || 0;
    const todayProfit = parseFloat(todayProfitInput) || 0;
    const hasTodayProfit = todayProfitInput.trim() !== '';

    let portfolio: UserPortfolio[] = [];
    if (currentUser) {
      portfolio = await getUserPortfolio(currentUser.username);
    } else {
      const key = getPortfolioKey();
      portfolio = JSON.parse(localStorage.getItem(key) || '[]');
    }

    if (portfolio.find(p => p.fundCode === selectedFund.code)) {
      alert('该基金已在持仓中');
      return;
    }

    const newItem: UserPortfolio = {
      id: Date.now().toString(),
      fundCode: selectedFund.code,
      fundName: selectedFund.name,
      holdingAmount: amount,
      holdingProfit: baseProfit,
      shares: 0,
      cost: amount - baseProfit,
      isProfitUpToDate: hasTodayProfit,
      manualTodayProfit: todayProfit,
      updateDate: dayjs().format('YYYY-MM-DD')
    };

    const newPortfolio = [...portfolio, newItem];

    if (currentUser) {
      await saveUserPortfolio(currentUser.username, newPortfolio);
    } else {
      const key = getPortfolioKey();
      localStorage.setItem(key, JSON.stringify(newPortfolio));
    }

    onAdded();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1E1F20] rounded-[28px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h2 className="text-2xl font-normal text-google-text dark:text-google-text-dark flex items-center gap-2">
            <Plus className="w-6 h-6 text-google-primary" /> 添加基金持仓
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-google-text-secondary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Step 1: Search - Only show if not pre-selected */}
          {!initialFund && (
            <div className="space-y-4">
              <label className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark ml-1">
                第一步：搜索基金
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-12 pr-32 py-3.5 bg-gray-50 dark:bg-[#131314] border-2 border-transparent focus:border-google-primary/30 rounded-2xl outline-none transition-all text-google-text dark:text-google-text-dark"
                  placeholder="输入基金名称或代码..."
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !keyword.trim()}
                  className="absolute right-2 top-2 bottom-2 px-6 bg-google-primary dark:bg-google-primary-dark text-white dark:text-google-bg-dark rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all text-sm"
                >
                  {isSearching ? '搜索中...' : '搜索'}
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && !selectedFund && (
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {searchResults.map(fund => (
                    <button
                      key={fund.code}
                      onClick={() => setSelectedFund(fund)}
                      className="flex items-center justify-between p-4 rounded-xl hover:bg-google-primary/5 dark:hover:bg-google-primary-dark/10 border border-transparent hover:border-google-primary/20 transition-all text-left group"
                    >
                      <div>
                        <div className="font-medium text-google-text dark:text-google-text-dark group-hover:text-google-primary">{fund.name}</div>
                        <div className="text-xs text-google-text-secondary font-mono mt-1">{fund.code} · {fund.type}</div>
                      </div>
                      <Plus className="w-5 h-5 text-google-text-secondary group-hover:text-google-primary opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Fund Display */}
          {selectedFund && (
            <div className="animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="p-6 bg-google-primary/5 dark:bg-google-primary-dark/10 rounded-2xl border border-google-primary/20 flex items-center justify-between">
                <div>
                  <div className="text-sm text-google-primary dark:text-google-primary-dark font-medium mb-1">已选择</div>
                  <div className="text-xl font-medium text-google-text dark:text-google-text-dark">{selectedFund.name}</div>
                  <div className="text-sm text-google-text-secondary font-mono">{selectedFund.code}</div>
                </div>
                <button 
                  onClick={() => setSelectedFund(null)}
                  className="text-xs text-google-primary underline hover:opacity-80"
                >
                  重选
                </button>
              </div>

              {/* Step 2: Input Details */}
              <div className="mt-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark ml-1 flex items-center gap-2">
                      <Wallet className="w-4 h-4" /> 持仓金额 (元)
                    </label>
                    <input
                      type="number"
                      value={holdingAmount}
                      onChange={(e) => setHoldingAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131314] border-2 border-transparent focus:border-google-primary/30 rounded-xl outline-none transition-all text-google-text dark:text-google-text-dark font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark ml-1 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> 持有收益 (元)
                    </label>
                    <input
                      type="number"
                      value={holdingProfit}
                      onChange={(e) => setHoldingProfit(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-[#131314] border-2 border-transparent focus:border-google-primary/30 rounded-xl outline-none transition-all text-google-text dark:text-google-text-dark font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark ml-1 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-google-blue" /> 今日收益 (元 - 可选)
                    </label>
                    <input
                      type="number"
                      value={todayProfitInput}
                      onChange={(e) => setTodayProfitInput(e.target.value)}
                      className="w-full px-4 py-3 bg-google-blue/5 dark:bg-google-blue/10 border-2 border-transparent focus:border-google-blue/30 rounded-xl outline-none transition-all text-google-text dark:text-google-text-dark font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  {todayProfitInput.trim() !== '' && (
                    <div className="flex items-start gap-2 p-4 bg-google-blue/10 rounded-xl text-xs text-google-blue leading-relaxed">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        已输入今日收益。系统将认为您输入的持仓和收益已包含今日涨跌，
                        <strong>今日将不再重复计算估值波动。</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-sm font-medium text-google-text-secondary hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedFund}
            className="px-8 py-2.5 bg-google-primary dark:bg-google-primary-dark text-white dark:text-google-bg-dark rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-google-primary/20 dark:shadow-none flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> 确认添加
          </button>
        </div>
      </div>
    </div>
  );
};
