import { navItems, routeTitles } from '../constants/routes';
import MyGreenhousesPage from '../pages/my-greenhouses/MyGreenhousesPage';
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
  const isMyGreenhousesRoute =
    routeState.route === 'my-greenhouses' || routeState.route === 'my-greenhouse';

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Основная навигация">
        <div>
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <img src="/logo.png" alt="" />
            </span>
            <div>
              <span className="brand-name">Умная теплица</span>
            </div>
          </div>

          <nav className="side-nav">
            {navItems.map((item) => (
              <a
                key={item.path}
                className={
                  item.route === 'my-greenhouses' && isMyGreenhousesRoute
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
        ) : isMyGreenhousesRoute ? (
          <MyGreenhousesPage
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
