import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import FundDetail from './pages/fund/FundDetail';
import Portfolio from './pages/portfolio/Portfolio';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/fund/:code" element={<FundDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
