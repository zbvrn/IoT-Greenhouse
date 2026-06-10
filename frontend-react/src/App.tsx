import { useCallback, useEffect, useState } from 'react';
import './App.css';
import AppLayout from './components/AppLayout';
import { getRouteStateFromHash } from './constants/routes';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import type { RouteState, User } from './types';
import { getDisplayName, getStoredUser } from './utils/user';

type AuthNotice = {
  text: string;
  type: 'success' | 'error';
} | null;

function App() {
  const [routeState, setRouteState] = useState<RouteState>(() =>
    getRouteStateFromHash(window.location.hash)
  );
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [authNotice, setAuthNotice] = useState<AuthNotice>(null);

  useEffect(() => {
    const handleHashChange = () => setRouteState(getRouteStateFromHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);

    if (!window.location.hash) {
      window.location.hash = token ? '#/greenhouses' : '#/login';
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [token]);

  useEffect(() => {
    const isAuthRoute = routeState.route === 'login' || routeState.route === 'register';
    if (!token && !isAuthRoute) {
      window.location.hash = '#/login';
    }
  }, [routeState.route, token]);

  const handleLogin = (nextToken: string, nextUser: User) => {
    localStorage.setItem('access_token', nextToken);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setAuthNotice(null);
    window.location.hash = '#/greenhouses';
  };

  const handleUserUpdate = useCallback((nextUser: User) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const handleRegister = () => {
    setAuthNotice({ text: 'Регистрация успешна. Теперь можно войти.', type: 'success' });
    window.location.hash = '#/login';
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setAuthNotice(null);
    window.location.hash = '#/login';
  };

  const handleAuthExpired = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setAuthNotice({ text: 'Сессия истекла. Войдите заново.', type: 'error' });
    window.location.hash = '#/login';
  }, []);

  if (!token && routeState.route === 'register') {
    return <RegisterPage onRegister={handleRegister} />;
  }

  if (!token || routeState.route === 'login') {
    return (
      <LoginPage
        notice={authNotice}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <AppLayout
      routeState={routeState}
      token={token}
      user={user}
      userName={getDisplayName(user)}
      onUserUpdate={handleUserUpdate}
      onAuthExpired={handleAuthExpired}
      onLogout={handleLogout}
    />
  );
}

export default App;
