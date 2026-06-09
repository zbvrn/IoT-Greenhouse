import { navItems, routeTitles } from '../constants/routes';
import ProfilePage from '../pages/ProfilePage';
import type { AppRoute, User } from '../types';

type AppLayoutProps = {
  route: AppRoute;
  token: string;
  user: User | null;
  userName: string;
  onUserUpdate: (user: User) => void;
  onLogout: () => void;
};

function AppLayout({
  route,
  token,
  user,
  userName,
  onUserUpdate,
  onLogout,
}: AppLayoutProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Основная навигация">
        <div>
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <span className="brand-name">Умная теплица</span>
            </div>
          </div>

          <nav className="side-nav">
            {navItems.map((item) => (
              <a
                key={item.path}
                className={item.route === route ? 'active' : ''}
                href={item.path}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="sidebar-account">
          <span>{userName}</span>
          <button type="button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </aside>

      <main className="workspace">
        <h1>{routeTitles[route]}</h1>
        {route === 'profile' ? (
          <ProfilePage
            token={token}
            user={user}
            onUserUpdate={onUserUpdate}
            onLogout={onLogout}
          />
        ) : (
          <section className="empty-state">
            <p>Раздел находится в разработке.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default AppLayout;
