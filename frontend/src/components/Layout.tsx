import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { SyncStatus } from './SyncStatus';

export function Layout() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar mobileOpen={mobileNavigationOpen} onMobileClose={() => setMobileNavigationOpen(false)} />
      <div className="min-w-0 flex-1 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileNavigationOpen((open) => !open)}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-blue-950 transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 lg:hidden"
              aria-label={mobileNavigationOpen ? 'Fechar navegação' : 'Abrir navegação'}
              aria-expanded={mobileNavigationOpen}
            >
              {mobileNavigationOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-blue-700">Central de resultados</p>
              <p className="truncate text-sm font-semibold text-blue-950">Dados e inteligência para seus jogos</p>
            </div>
            <div className="hidden sm:block"><SyncStatus /></div>
          </div>
          <div className="border-t border-slate-100 px-4 py-2 sm:hidden"><SyncStatus compact /></div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
