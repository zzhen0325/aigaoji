import { create } from 'zustand';
import axios from 'axios';
import { User } from '../types';

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
      const response = await axios.get('/api/local-users');
      if (Array.isArray(response.data) && response.data.length > 0) {
        set({ users: response.data });
        localStorage.setItem('all_users', JSON.stringify(response.data));
      } else {
        // Try fallback to localStorage
        const stored = localStorage.getItem('all_users');
        if (stored) {
          set({ users: JSON.parse(stored) });
        }
      }
    } catch (error) {
      console.error('Failed to load users from JSON persistence', error);
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
    
    const updatedUsers = [...currentUsers, newUser];
    
    try {
      await axios.post('/api/local-users', updatedUsers);
      set({ users: updatedUsers });
      localStorage.setItem('all_users', JSON.stringify(updatedUsers));
      return true;
    } catch (error) {
      console.error('Failed to save user to JSON', error);
      // Even if API fails, save to localStorage to keep app functional in browser
      set({ users: updatedUsers });
      localStorage.setItem('all_users', JSON.stringify(updatedUsers));
      return true;
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
