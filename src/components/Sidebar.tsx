'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from './Icon';

const LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/', label: 'Panel', icon: 'home' },
  { href: '/channels', label: 'Canales', icon: 'play' },
  { href: '/extract', label: 'Extraer', icon: 'extract' },
  { href: '/results', label: 'Resultados', icon: 'list' },
  { href: '/media', label: 'Media Hub', icon: 'image' },
  { href: '/youtube', label: 'Publicar', icon: 'upload' },
  { href: '/core', label: 'Base de datos', icon: 'database' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Icon name="play" size={16} />
        </span>
        YT Studio
      </div>
      <nav className="nav">
        {LINKS.map(({ href, label, icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
              <Icon name={icon} />
              {label}
            </Link>
          );
        })}
      </nav>
      <nav className="nav" style={{ flex: 'none' }}>
        <button onClick={logout}>
          <Icon name="logout" />
          Salir
        </button>
      </nav>
    </aside>
  );
}
