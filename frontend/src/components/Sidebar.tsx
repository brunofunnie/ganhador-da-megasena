import { NavLink } from 'react-router-dom';
import { BarChart3, Dices, History, LayoutDashboard, Trophy } from 'lucide-react';

const links = [
  { to: '/', label: 'Painel', icon: LayoutDashboard },
  { to: '/gerador', label: 'Gerador & Simulador', icon: Dices },
  { to: '/analise', label: 'Análise', icon: BarChart3 },
  { to: '/sorteios', label: 'Sorteios', icon: History },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  return (
    <>
      {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-blue-950/45 lg:hidden" aria-label="Fechar navegação" onClick={onMobileClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-[linear-gradient(155deg,#071c4d,#0b3a8c)] px-4 py-5 text-white shadow-2xl transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-yellow-400 text-blue-950 shadow-lg shadow-blue-950/30" aria-hidden="true"><Trophy size={22} strokeWidth={2.5} /></span>
          <div>
            <p className="text-base font-extrabold tracking-tight">Ganhador Mega Sena</p>
            <p className="mt-0.5 text-xs text-blue-100">Inteligência para seus jogos</p>
          </div>
        </div>
        <nav className="space-y-1" aria-label="Navegação principal">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
                  isActive
                    ? 'bg-yellow-400 text-blue-950 shadow-sm'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-white/15 bg-white/10 p-3 text-xs leading-5 text-blue-100">
          Consulte resultados e encontre padrões com dados atualizados da Mega-Sena.
        </div>
      </aside>
    </>
  );
}
