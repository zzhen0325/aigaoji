import { create } from 'zustand';

export type MarketDataSource = 'fundf10' | 'fundmob';

const STORAGE_KEY = 'market_data_source';
const DEFAULT_SOURCE: MarketDataSource = 'fundmob';

const readStoredSource = (): MarketDataSource => {
  if (typeof window === 'undefined') return DEFAULT_SOURCE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as MarketDataSource | null;
    return stored === 'fundmob' || stored === 'fundf10' ? stored : DEFAULT_SOURCE;
  } catch {
    return DEFAULT_SOURCE;
  }
};

interface MarketDataState {
  source: MarketDataSource;
  setSource: (source: MarketDataSource) => void;
}

export const useMarketDataStore = create<MarketDataState>((set) => ({
  source: readStoredSource(),
  setSource: (source) => {
    try {
      localStorage.setItem(STORAGE_KEY, source);
    } catch {
    }
    set({ source });
  }
}));

export const getMarketDataSource = () => readStoredSource();
