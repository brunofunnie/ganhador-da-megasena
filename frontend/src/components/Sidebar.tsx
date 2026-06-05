import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Painel', icon: '📊' },
  { to: '/gerador', label: 'Gerador & Simulador', icon: '🎲' },
  { to: '/estrategias', label: 'Estratégias', icon: '🎯' },
  { to: '/analise', label: 'Análise', icon: '📈' },
];

export function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 hidden md:flex flex-col gap-1">
      <div className="text-lg font-bold text-white mb-6 px-3 pt-2">
        🎰 Mega Sena
      </div>
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive
                ? 'bg-green-900/50 text-green-400 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`
          }
        >
          <span>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </aside>
  );
}
