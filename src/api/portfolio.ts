import { UserPortfolio } from '@/types';
import { supabase } from '@/lib/supabaseClient';

export const loadPortfolios = async (): Promise<Record<string, UserPortfolio[]>> => {
  try {
    const { data, error } = await supabase
      .from('portfolios')
      .select('username,items');

    if (error) {
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      const mapped = data.reduce<Record<string, UserPortfolio[]>>((acc, row) => {
        acc[row.username] = Array.isArray(row.items) ? row.items : [];
        return acc;
      }, {});
      localStorage.setItem('all_portfolios', JSON.stringify(mapped));
      return mapped;
    }
    const stored = localStorage.getItem('all_portfolios');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load portfolios from Supabase', error);
    const stored = localStorage.getItem('all_portfolios');
    return stored ? JSON.parse(stored) : {};
  }
};

export const savePortfolios = async (portfolios: Record<string, UserPortfolio[]>) => {
  try {
    const payload = Object.entries(portfolios).map(([username, items]) => ({
      username,
      items
    }));

    localStorage.setItem('all_portfolios', JSON.stringify(portfolios));

    if (payload.length > 0) {
      const { error } = await supabase
        .from('portfolios')
        .upsert(payload, { onConflict: 'username' });

      if (error) {
        throw error;
      }
    }
  } catch (error) {
    console.error('Failed to save portfolios to Supabase', error);
  }
};

export const getUserPortfolio = async (username: string): Promise<UserPortfolio[]> => {
  if (!username) return [];
  try {
    const { data, error } = await supabase
      .from('portfolios')
      .select('items')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data && Array.isArray(data.items)) {
      return data.items;
    }
  } catch (error) {
    console.error('Failed to load user portfolio from Supabase', error);
  }

  const stored = localStorage.getItem('all_portfolios');
  if (!stored) return [];
  const portfolios = JSON.parse(stored) as Record<string, UserPortfolio[]>;
  return portfolios[username] || [];
};

export const saveUserPortfolio = async (username: string, portfolio: UserPortfolio[]) => {
  if (!username) return;
  try {
    const { error } = await supabase
      .from('portfolios')
      .upsert({ username, items: portfolio }, { onConflict: 'username' });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Failed to save user portfolio to Supabase', error);
  }

  const stored = localStorage.getItem('all_portfolios');
  const portfolios = stored ? (JSON.parse(stored) as Record<string, UserPortfolio[]>) : {};
  portfolios[username] = portfolio;
  localStorage.setItem('all_portfolios', JSON.stringify(portfolios));
};
