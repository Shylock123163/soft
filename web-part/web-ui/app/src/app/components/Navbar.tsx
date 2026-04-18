import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Monitor, MessageSquare, LogIn, Info } from 'lucide-react';

const links = [
  { to: '/', label: '首页', icon: Home },
  { to: '/monitor', label: '监控室', icon: Monitor },
  { to: '/chat', label: '对话', icon: MessageSquare },
  { to: '/login', label: '登录', icon: LogIn },
  { to: '/about', label: '关于', icon: Info },
];

export function Navbar() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <header className="navbar">
        <Link to="/" className="navbar-brand">暗域捕手</Link>
        <nav className="navbar-links">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={location.pathname === to ? 'active' : ''}>
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
        <div className={`hamburger ${sidebarOpen ? 'is' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
          <span /><span /><span />
        </div>
      </header>
      <nav className={`sidebar-nav ${sidebarOpen ? 'open' : ''}`}>
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={location.pathname === to ? 'active' : ''} onClick={() => setSidebarOpen(false)}>
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
