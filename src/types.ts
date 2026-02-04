export interface FundInfo {
  code: string;
  name: string;
  type: string;
  company?: string;
  manager?: string;
  establishDate?: string;
  totalAssets?: string;
  netWorth?: number; // Latest official net worth (Unit Net Value)
  netWorthDate?: string;
  dayGrowth?: string; // e.g. "1.23%"
}

export interface FundHolding {
  stockCode: string;
  stockName: string;
  weight: number; // Percentage, e.g., 8.5
  market?: string; // '0' for SZ, '1' for SH, etc.
}

export interface StockRealtime {
  code: string; // Full code e.g. "sh600519"
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  time: string;
}

export interface FundValuation {
  fundCode: string;
  estimatedValue: number; // Estimated Net Value
  previousValue: number; // Previous Net Value (T-1)
  change: number;
  changePercent: number; // Estimated Change Percent
  calculationTime: string;
  holdings: {
    stock: FundHolding;
    realtime: StockRealtime | null;
  }[];
  totalWeight: number; // Total weight of holdings we could fetch
}

export interface UserPortfolio {
  id: string;
  fundCode: string;
  fundName: string;
  holdingAmount: number; // Current Market Value (snapshot)
  holdingProfit: number; // Accumulated Profit (snapshot)
  shares: number; // Calculated shares
  cost: number; // Calculated cost
  
  // Real-time fields
  realtimeValue?: number;
  realtimeProfit?: number;
  realtimeProfitRate?: number;
  todayProfit?: number; // Profit just for today

  // Transaction history and reconciliation
  transactions?: Transaction[];
  lastUpdateDate?: string; // YYYY-MM-DD
  isProfitUpToDate?: boolean; // If true, today's change is provided manually
  manualTodayProfit?: number; // The user-inputted profit for today
  updateDate?: string; // Date when isProfitUpToDate was set
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'buy' | 'sell';
  timestamp: string; // ISO string
  effectiveDate: string; // YYYY-MM-DD (when it affects base holding)
  profitStartDate: string; // YYYY-MM-DD (when it starts contributing to P/L)
  isReconciled?: boolean;
}

export interface User {
  username: string;
  password?: string; // Optional because we might not want to expose it in UI state, but need it for check
  avatar: string;
}
