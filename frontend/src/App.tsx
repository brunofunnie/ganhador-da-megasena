import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Gerador } from './pages/Gerador';
import { Analise } from './pages/Analise';
import { Sorteios } from './pages/Sorteios';
import { Carteiras } from './pages/Carteiras';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gerador" element={<Gerador />} />
            <Route path="/simulador" element={<Navigate to="/gerador" replace />} />
            <Route path="/carteiras" element={<Carteiras />} />
            <Route path="/analise" element={<Analise />} />
            <Route path="/sorteios" element={<Sorteios />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
