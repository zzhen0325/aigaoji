import axios from 'axios';
import { UserPortfolio } from '../types';

export const loadPortfolios = async (): Promise<Record<string, UserPortfolio[]>> => {
  try {
    const response = await axios.get('/api/local-portfolios');
    if (response.data && Object.keys(response.data).length > 0) {
      localStorage.setItem('all_portfolios', JSON.stringify(response.data));
      return response.data;
    }
    const stored = localStorage.getItem('all_portfolios');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load portfolios from JSON persistence', error);
    const stored = localStorage.getItem('all_portfolios');
    return stored ? JSON.parse(stored) : {};
  }
};

export const savePortfolios = async (portfolios: Record<string, UserPortfolio[]>) => {
  try {
    localStorage.setItem('all_portfolios', JSON.stringify(portfolios));
    await axios.post('/api/local-portfolios', portfolios);
  } catch (error) {
    console.error('Failed to save portfolios to JSON', error);
  }
};

export const getUserPortfolio = async (username: string): Promise<UserPortfolio[]> => {
  if (!username) return [];
  const portfolios = await loadPortfolios();
  return portfolios[username] || [];
};

export const saveUserPortfolio = async (username: string, portfolio: UserPortfolio[]) => {
  if (!username) return;
  const portfolios = await loadPortfolios();
  portfolios[username] = portfolio;
  await savePortfolios(portfolios);
};
