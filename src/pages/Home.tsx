import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Sparkles, TrendingUp } from 'lucide-react';
import { searchFunds } from '@/api/fund';
import { FundInfo } from '@/types';

const Home: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<FundInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query) {
      performSearch(query);
    } else {
      setHasSearched(false);
      setResults([]);
    }
  }, [query]);

  const performSearch = async (keyword: string) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchFunds(keyword);
      setResults(data);
    } catch (error) {
      console.error(error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {!hasSearched && (
        <div className="space-y-4 py-10 text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-normal text-transparent bg-clip-text bg-gradient-to-r from-google-primary to-[#4285F4] dark:from-google-primary-dark dark:to-[#8AB4F8] tracking-tight">
            你好，基金投资者
          </h1>
          <p className="text-2xl text-google-text-secondary dark:text-google-text-secondary-dark font-light">
            今天想查询哪只基金？
          </p>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-lg font-medium text-google-text dark:text-google-text-dark">
                    {loading ? '正在搜索...' : `"${query}" 的搜索结果`}
                </h3>
                {results.length > 0 && (
                    <span className="text-sm text-google-text-secondary">找到 {results.length} 只基金</span>
                )}
            </div>
            
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-google-primary"></div>
                </div>
            ) : results.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.map((fund) => (
                        <div
                            key={fund.code}
                            onClick={() => navigate(`/fund/${fund.code}`)}
                            className="bg-google-surface dark:bg-google-surface-dark rounded-2xl p-5 hover:bg-gray-200 dark:hover:bg-[#2C2D2E] cursor-pointer transition-colors border border-transparent hover:border-google-outline/20 group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-lg font-medium text-google-text dark:text-google-text-dark group-hover:text-google-primary dark:group-hover:text-google-primary-dark transition-colors">
                                        {fund.name}
                                    </h4>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <span className="text-sm font-mono bg-white dark:bg-black/30 px-2 py-0.5 rounded text-google-text-secondary dark:text-google-text-secondary-dark">
                                            {fund.code}
                                        </span>
                                        <span className="text-sm text-google-text-secondary dark:text-google-text-secondary-dark">
                                            {fund.type}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-google-text-secondary dark:text-google-text-secondary-dark opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-google-surface dark:bg-google-surface-dark rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                    <p className="text-google-text-secondary dark:text-google-text-secondary-dark text-lg">未找到匹配的基金</p>
                    <p className="text-sm text-google-text-secondary opacity-60 mt-2">请尝试搜索其他基金名称或代码</p>
                </div>
            )}
        </div>
      )}
      
      {hasSearched && results.length === 0 && !loading && (
        <div className="text-center py-12 text-google-text-secondary dark:text-google-text-secondary-dark">
            未找到匹配的基金。
        </div>
      )}

      {/* Recommended / Watchlist Preview */}
      {!hasSearched && (
        <div className="space-y-6">
            <div className="flex items-center space-x-2 px-2">
                <Sparkles className="h-5 w-5 text-google-primary dark:text-google-primary-dark" />
                <h2 className="text-lg font-medium text-google-text dark:text-google-text-dark">热门基金</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {['000001', '005827', '161725', '110011'].map((code) => (
                    <RecommendedFundCard key={code} code={code} navigate={navigate} />
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

const RecommendedFundCard = ({ code, navigate }: { code: string, navigate: any }) => {
    const names: Record<string, string> = {
        '000001': '华夏成长混合',
        '005827': '易方达蓝筹精选',
        '161725': '招商中证白酒',
        '110011': '易方达中小盘'
    };
    
    return (
        <div 
            onClick={() => navigate(`/fund/${code}`)}
            className="bg-google-surface dark:bg-google-surface-dark p-5 rounded-2xl hover:bg-gray-200 dark:hover:bg-[#2C2D2E] cursor-pointer transition-colors border border-transparent hover:border-google-outline/20 h-full flex flex-col justify-between"
        >
            <div>
                <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-medium text-google-primary dark:text-google-primary-dark bg-google-primary/10 dark:bg-google-primary-dark/10 px-2 py-1 rounded-full">
                        热门
                    </span>
                    <TrendingUp className="h-4 w-4 text-google-text-secondary dark:text-google-text-secondary-dark" />
                </div>
                <h3 className="font-medium text-google-text dark:text-google-text-dark line-clamp-2 mb-1">
                    {names[code]}
                </h3>
            </div>
            <p className="text-sm text-google-text-secondary dark:text-google-text-secondary-dark font-mono mt-2">
                {code}
            </p>
        </div>
    );
}

export default Home;
