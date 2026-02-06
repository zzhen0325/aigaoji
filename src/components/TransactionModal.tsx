import React, { useState, useEffect } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, Clock, Check } from 'lucide-react';
import { UserPortfolio, Transaction } from '@/types';
import { useUserStore } from '@/store/userStore';
import { getUserPortfolio, saveUserPortfolio } from '@/api/portfolio';
import { getTradeStatusInfo } from '@/utils/tradingUtils';
import dayjs from 'dayjs';
import { useToast } from '@/hooks/useToast';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: UserPortfolio | null;
  onSuccess: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, fund, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [tradeInfo, setTradeInfo] = useState(getTradeStatusInfo());
  const { currentUser } = useUserStore();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setType('buy');
      setTradeInfo(getTradeStatusInfo());
      // Refresh time every minute while modal is open
      const timer = setInterval(() => {
        setTradeInfo(getTradeStatusInfo());
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  const handleTransaction = async () => {
    if (!fund || !currentUser || !amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('请输入有效的金额', 'error');
      return;
    }

    if (type === 'sell' && numAmount > fund.holdingAmount) {
      showToast('卖出金额不能超过当前持仓', 'error');
      return;
    }

    try {
      const portfolio = await getUserPortfolio(currentUser.username);
      const updatedPortfolio = portfolio.map(item => {
        if (item.fundCode === fund.fundCode) {
          const newTransaction: Transaction = {
            id: Date.now().toString(),
            amount: numAmount,
            type: type,
            timestamp: dayjs().toISOString(),
            effectiveDate: tradeInfo.effectiveDate,
            profitStartDate: tradeInfo.profitDate,
            isReconciled: false
          };
          
          return {
            ...item,
            transactions: [...(item.transactions || []), newTransaction]
          };
        }
        return item;
      });

      await saveUserPortfolio(currentUser.username, updatedPortfolio);
      onSuccess();
      onClose();
      showToast(`${type === 'buy' ? '加仓' : '减仓'}提交成功`, 'success');
    } catch (error) {
      console.error('Transaction failed:', error);
      showToast('交易失败，请重试', 'error');
    }
  };

  if (!isOpen || !fund) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1E1F20] rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-xl font-normal text-google-text dark:text-google-text-dark">
              加减仓操作
            </h2>
            <p className="text-[10px] sm:text-xs text-google-text-secondary mt-0.5 sm:mt-1">{fund.fundName} ({fund.fundCode})</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-google-text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          {/* Type Selector */}
          <div className="flex bg-gray-100 dark:bg-[#131314] p-1 rounded-2xl">
            <button
              onClick={() => setType('buy')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                type === 'buy' 
                  ? 'bg-white dark:bg-gray-800 text-google-red shadow-sm' 
                  : 'text-google-text-secondary hover:text-google-text'
              }`}
            >
              <ArrowUpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 买入 (加仓)
            </button>
            <button
              onClick={() => setType('sell')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                type === 'sell' 
                  ? 'bg-white dark:bg-gray-800 text-google-green shadow-sm' 
                  : 'text-google-text-secondary hover:text-google-text'
              }`}
            >
              <ArrowDownCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 卖出 (减仓)
            </button>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-xs sm:text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark ml-1">
              金额 (元)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-2.5 sm:top-3.5 text-base sm:text-lg font-medium text-google-text-secondary">¥</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3.5 bg-gray-50 dark:bg-[#131314] border-2 border-transparent focus:border-google-primary/30 rounded-2xl outline-none transition-all text-xl sm:text-2xl font-mono text-google-text dark:text-google-text-dark"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          {/* Trade Info / Deadline Logic */}
          <div className={`p-3 sm:p-4 rounded-2xl border ${
            tradeInfo.status === 'before_deadline' 
              ? 'bg-google-blue/5 border-google-blue/20 text-google-blue' 
              : 'bg-orange-500/5 border-orange-500/20 text-orange-500'
          }`}>
            <div className="flex gap-2.5 sm:gap-3">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium">{tradeInfo.message}</p>
                <p className="text-[10px] sm:text-xs opacity-80 leading-relaxed">{tradeInfo.detail}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/10 flex justify-end gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium text-google-text-secondary hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleTransaction}
            disabled={!amount}
            className={`px-6 sm:px-8 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium text-white dark:text-google-bg-dark hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5 sm:gap-2 ${
              type === 'buy' ? 'bg-google-red shadow-google-red/20' : 'bg-google-green shadow-google-green/20'
            }`}
          >
            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 确认{type === 'buy' ? '买入' : '卖出'}
          </button>
        </div>
      </div>
    </div>
  );
};
