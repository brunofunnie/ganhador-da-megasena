import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Gerador } from './pages/Gerador';
import { Estrategias } from './pages/Estrategias';
import { Analise } from './pages/Analise';

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
            <Route path="/estrategias" element={<Estrategias />} />
            <Route path="/analise" element={<Analise />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
