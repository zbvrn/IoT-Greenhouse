import { navItems, routeTitles } from '../constants/routes';
import GreenhousesPage from '../pages/greenhouses/GreenhousesPage';
import ManifestGreenhousesPage from '../pages/manifest-greenhouses/ManifestGreenhousesPage';
import ProfilePage from '../pages/ProfilePage';
import type { RouteState, User } from '../types';

type AppLayoutProps = {
  routeState: RouteState;
  token: string;
  user: User | null;
  userName: string;
  onUserUpdate: (user: User) => void;
  onAuthExpired: () => void;
  onLogout: () => void;
};

function AppLayout({
  routeState,
  token,
  user,
  userName,
  onUserUpdate,
  onAuthExpired,
  onLogout,
}: AppLayoutProps) {
  const isGreenhousesRoute =
    routeState.route === 'greenhouses' || routeState.route === 'greenhouse';
  const isManifestGreenhousesRoute =
    routeState.route === 'greenhouses-new' || routeState.route === 'greenhouse-new';

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
                className={
                  item.route === 'greenhouses' && isGreenhousesRoute
                    ? 'active'
                    : item.route === 'greenhouses-new' && isManifestGreenhousesRoute
                      ? 'active'
                    : item.route === routeState.route
                      ? 'active'
                      : ''
                }
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
        {routeState.route === 'profile' ? (
          <>
            <h1>{routeTitles.profile}</h1>
            <ProfilePage
              token={token}
              user={user}
              onUserUpdate={onUserUpdate}
              onAuthExpired={onAuthExpired}
              onLogout={onLogout}
            />
          </>
        ) : isGreenhousesRoute ? (
          <GreenhousesPage
            token={token}
            routeState={routeState}
            onAuthExpired={onAuthExpired}
          />
        ) : isManifestGreenhousesRoute ? (
          <ManifestGreenhousesPage
            token={token}
            routeState={routeState}
            onAuthExpired={onAuthExpired}
          />
        ) : (
          <>
            <h1>{routeTitles[routeState.route]}</h1>
            <section className="empty-state">
              <p>Раздел находится в разработке.</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default AppLayout;
