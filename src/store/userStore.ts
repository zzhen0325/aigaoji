import { create } from 'zustand';
import { User } from '@/types';
import { supabase } from '@/lib/supabaseClient';

interface UserState {
  currentUser: User | null;
  users: User[];
  isLoadingUsers: boolean;
  login: (user: User) => void;
  logout: () => void;
  register: (user: User) => Promise<boolean>; // returns success
  checkUser: (username: string) => User | undefined;
  loadUsers: () => Promise<void>;
}

// Helper to get initial current user from localStorage (for persistence across refresh)
const getStoredCurrentUser = (): User | null => {
    try {
        const stored = localStorage.getItem('current_user');
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('Failed to parse current user from localStorage', e);
        return null;
    }
}

export const useUserStore = create<UserState>((set, get) => ({
  currentUser: getStoredCurrentUser(),
  users: [],
  isLoadingUsers: false,

  loadUsers: async () => {
    set({ isLoadingUsers: true });
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username,password,avatar')
        .order('username');

      if (error) {
        throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        set({ users: data });
        localStorage.setItem('all_users', JSON.stringify(data));
      } else {
        const stored = localStorage.getItem('all_users');
        if (stored) {
          set({ users: JSON.parse(stored) });
        }
      }
    } catch (error) {
      console.error('Failed to load users from Supabase', error);
      const stored = localStorage.getItem('all_users');
      if (stored) {
        set({ users: JSON.parse(stored) });
      }
    } finally {
      set({ isLoadingUsers: false });
    }
  },

  login: (user: User) => {
    localStorage.setItem('current_user', JSON.stringify(user));
    set({ currentUser: user });
  },

  logout: () => {
    localStorage.removeItem('current_user');
    set({ currentUser: null });
  },

  register: async (newUser: User) => {
    const { users, loadUsers } = get();
    // Ensure we have latest users
    if (users.length === 0) await loadUsers();
    
    const currentUsers = get().users;
    if (currentUsers.some(u => u.username === newUser.username)) {
      return false; // User already exists
    }

    try {
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('username')
        .eq('username', newUser.username)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existing) {
        return false;
      }

      const { error } = await supabase
        .from('users')
        .insert({
          username: newUser.username,
          password: newUser.password,
          avatar: newUser.avatar
        });

      if (error) {
        throw error;
      }

      const updatedUsers = [...currentUsers, newUser];
      set({ users: updatedUsers });
      localStorage.setItem('all_users', JSON.stringify(updatedUsers));
      return true;
    } catch (error) {
      console.error('Failed to save user to Supabase', error);
      return false;
    }
  },
  
  checkUser: (username: string) => {
    const { users } = get();
    return users.find(u => u.username === username);
  }
}));

export const getPortfolioKey = (username?: string) => {
  if (!username) return 'portfolio';
  return `portfolio_${username}`;
};
