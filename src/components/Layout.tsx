import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, PieChart, Menu, X, Sun, Moon, BadgeJapaneseYen, LogOut } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useUserStore } from '../store/userStore';
import { AuthModal } from './AuthModal';
import { useToast } from '@/hooks/useToast';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const { isDark, toggleTheme } = useTheme();
  const { currentUser, logout, loadUsers } = useUserStore();
  const { showToast } = useToast();

  // Load users from JSON on mount
  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKeyword.trim()) return;
    navigate(`/?q=${encodeURIComponent(searchKeyword.trim())}`);
  };

  const handleLogout = () => {
    logout();
    showToast('已退出登录', 'info');
  };

  const isActive = (path: string) => location.pathname === path;
  
  const navItems = [
    { name: '自选持仓', path: '/portfolio', icon: PieChart },
  ];

  return (
    <div className="min-h-screen bg-google-bg dark:bg-google-bg-dark text-google-text dark:text-google-text-dark font-sans transition-colors duration-200">
      <nav className="fixed w-full top-0 z-50 bg-google-bg dark:bg-google-bg-dark transition-colors duration-200">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2 group mr-8">
                 {/* Google-like logo icon */}
                 <div className="text-google-primary dark:text-google-primary-dark">
                    <BadgeJapaneseYen className="h-6 w-6" />
                 </div>
                <span className="text-xl font-medium tracking-tight text-gray-700 dark:text-gray-200">爱搞基</span>
              </Link>
              
              <div className="hidden sm:flex space-x-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                      isActive(item.path)
                        ? 'bg-google-primary/10 text-google-primary dark:bg-google-primary-dark/20 dark:text-google-primary-dark'
                        : 'text-google-text-secondary dark:text-google-text-secondary-dark hover:bg-gray-100 dark:hover:bg-google-surface-dark'
                    }`}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Centered Search Box */}
            <div className="hidden md:flex flex-1 max-w-xl px-8 justify-center">
              <form onSubmit={handleSearch} className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-google-text-secondary dark:text-google-text-secondary-dark" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-4 py-2 rounded-full bg-gray-100 dark:bg-google-surface-dark border-transparent focus:bg-white dark:focus:bg-[#131314] focus:border-google-primary/30 focus:ring-4 focus:ring-google-primary/5 transition-all text-sm outline-none"
                  placeholder="搜索基金..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
              </form>
            </div>
            
            <div className="flex items-center space-x-2">
                <button
                    onClick={toggleTheme}
                    className="p-2.5 rounded-full text-google-text-secondary dark:text-google-text-secondary-dark hover:bg-gray-100 dark:hover:bg-google-surface-dark transition-colors focus:outline-none"
                    aria-label="Toggle Theme"
                >
                    {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>

                {/* User Auth UI */}
                {currentUser ? (
                    <div className="flex items-center space-x-3 ml-2 pl-2  dark:border-gray-700">
                        <div className="flex items-center space-x-2">
                            <span className="text-2xl select-none">{currentUser.avatar}</span>
                            <span className="text-sm font-medium hidden md:block">{currentUser.username}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-full text-google-text-secondary dark:text-google-text-secondary-dark hover:bg-gray-100 dark:hover:bg-google-surface-dark transition-colors"
                            title="退出登录"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className="ml-2 px-5 py-2 bg-google-primary dark:bg-google-primary-dark text-white dark:text-google-bg-dark rounded-full text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
                    >
                        登录
                    </button>
                )}

                <div className="flex items-center sm:hidden ml-2">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="inline-flex items-center justify-center p-2 rounded-full text-google-text-secondary dark:text-google-text-secondary-dark hover:bg-gray-100 dark:hover:bg-google-surface-dark focus:outline-none"
                >
                    <span className="sr-only">Open main menu</span>
                    {isMenuOpen ? (
                    <X className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                    <Menu className="block h-6 w-6" aria-hidden="true" />
                    )}
                </button>
                </div>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="sm:hidden bg-google-surface dark:bg-google-surface-dark border-t border-gray-200 dark:border-gray-800">
            <div className="px-4 py-4 space-y-4">
              <form onSubmit={handleSearch} className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-google-text-secondary dark:text-google-text-secondary-dark" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-4 py-2 rounded-full bg-gray-100 dark:bg-google-surface-dark border-transparent focus:bg-white dark:focus:bg-[#131314] focus:border-google-primary/30 transition-all text-sm outline-none"
                  placeholder="搜索基金..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
              </form>
              <div className="space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block px-3 py-3 rounded-r-full text-base font-medium ${
                      isActive(item.path)
                        ? 'bg-google-primary/10 text-google-primary dark:bg-google-primary-dark/20 dark:text-google-primary-dark'
                        : 'text-google-text-secondary dark:text-google-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <item.icon className="h-5 w-5 mr-3" />
                      {item.name}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 mt-16">
        {children}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

export default Layout;
