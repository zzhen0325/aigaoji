import React, { useState } from 'react';
import { X, User, Lock } from 'lucide-react';
import { useUserStore } from '../store/userStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATARS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄'];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState('');
  
  const { login, register, checkUser } = useUserStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }

    if (isLogin) {
      const user = checkUser(username);
      if (user && user.password === password) {
        login(user);
        onClose();
        // Reset form
        setUsername('');
        setPassword('');
      } else {
        setError('用户名或密码错误');
      }
    } else {
      // Register
      const success = await register({
        username,
        password,
        avatar: selectedAvatar
      });
      
      if (success) {
        // Auto login after register
        login({ username, password, avatar: selectedAvatar });
        onClose();
        // Reset form
        setUsername('');
        setPassword('');
      } else {
        setError('用户名已存在');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1E1F20] rounded-[24px] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="relative p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-2xl font-normal text-center text-google-text dark:text-google-text-dark">
            {isLogin ? '欢迎回来' : '创建账号'}
          </h2>
          <button 
            onClick={onClose}
            className="absolute right-6 top-6 text-google-text-secondary dark:text-google-text-secondary-dark hover:text-google-text dark:hover:text-google-text-dark transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Tabs */}
            <div className="flex p-1 mb-6 bg-gray-100 dark:bg-google-surface-dark rounded-full">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-200 ${isLogin ? 'bg-white dark:bg-[#2C2D2E] shadow-sm text-google-text dark:text-google-text-dark' : 'text-google-text-secondary dark:text-google-text-secondary-dark'}`}
                onClick={() => setIsLogin(true)}
              >
                登录
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-200 ${!isLogin ? 'bg-white dark:bg-[#2C2D2E] shadow-sm text-google-text dark:text-google-text-dark' : 'text-google-text-secondary dark:text-google-text-secondary-dark'}`}
                onClick={() => setIsLogin(false)}
              >
                注册
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark ml-1">用户名</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-[#131314] border border-transparent focus:border-google-primary dark:focus:border-google-primary-dark rounded-xl outline-none transition-all text-google-text dark:text-google-text-dark"
                    placeholder="请输入用户名"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark ml-1">密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-[#131314] border border-transparent focus:border-google-primary dark:focus:border-google-primary-dark rounded-xl outline-none transition-all text-google-text dark:text-google-text-dark"
                    placeholder="请输入密码"
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-google-text-secondary dark:text-google-text-secondary-dark ml-1">选择头像</label>
                  <div className="grid grid-cols-8 gap-2 p-2 bg-gray-50 dark:bg-[#131314] rounded-xl">
                    {AVATARS.map(avatar => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`w-8 h-8 flex items-center justify-center text-lg rounded-full transition-all ${selectedAvatar === avatar ? 'bg-white dark:bg-[#2C2D2E] shadow-md scale-110' : 'hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-google-primary dark:bg-google-primary-dark text-white dark:text-google-bg-dark font-medium rounded-full hover:opacity-90 transition-opacity shadow-lg shadow-google-primary/20 dark:shadow-none"
            >
              {isLogin ? '登 录' : '注 册'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
