import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { store, flushOutbox } from './lib/store';

export default function App() {
  useEffect(() => {
    (async () => {
      await store.hydrate();
      await flushOutbox();
      store.enrichMissing();
    })();
    const onOnline = async () => {
      await flushOutbox();
      await store.hydrate();
      store.enrichMissing();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link';

  return (
    <div className="app">
      <main className="main">
        <Outlet />
      </main>
      <nav className="nav">
        <NavLink to="/capture" className={linkClass}>Capture</NavLink>
        <NavLink to="/review" className={linkClass}>Review</NavLink>
        <NavLink to="/list" className={linkClass}>List</NavLink>
      </nav>
    </div>
  );
}
