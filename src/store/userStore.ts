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
      if (Array.isArray(response.data)) {
        set({ users: response.data });
        
        // Also sync to localStorage as a backup or cache if needed, 
        // but the prompt asked for JSON persistence.
        // We will trust the API response as the source of truth.
      }
    } catch (error) {
      console.error('Failed to load users from JSON persistence', error);
      // Fallback to localStorage if API fails?
      // For now, let's stick to the requested JSON requirement.
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
      return true;
    } catch (error) {
      console.error('Failed to save user to JSON', error);
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
