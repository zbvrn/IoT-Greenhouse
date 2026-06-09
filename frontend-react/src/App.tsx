import { useCallback, useEffect, useState } from 'react';
import './App.css';
import AppLayout from './components/AppLayout';
import { getRouteFromHash } from './constants/routes';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import type { AppRoute, User } from './types';
import { getDisplayName, getStoredUser } from './utils/user';

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromHash(window.location.hash));
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [registrationMessage, setRegistrationMessage] = useState('');

  useEffect(() => {
    const handleHashChange = () => setRoute(getRouteFromHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);

    if (!window.location.hash) {
      window.location.hash = token ? '#/greenhouses' : '#/login';
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [token]);

  useEffect(() => {
    const isAuthRoute = route === 'login' || route === 'register';
    if (!token && !isAuthRoute) {
      window.location.hash = '#/login';
    }
  }, [route, token]);

  const handleLogin = (nextToken: string, nextUser: User) => {
    localStorage.setItem('access_token', nextToken);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setRegistrationMessage('');
    window.location.hash = '#/greenhouses';
  };

  const handleUserUpdate = useCallback((nextUser: User) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const handleRegister = () => {
    setRegistrationMessage('Регистрация успешна. Теперь можно войти.');
    window.location.hash = '#/login';
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setRegistrationMessage('');
    window.location.hash = '#/login';
  };

  if (!token && route === 'register') {
    return <RegisterPage onRegister={handleRegister} />;
  }

  if (!token || route === 'login') {
    return (
      <LoginPage
        successMessage={registrationMessage}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <AppLayout
      route={route}
      token={token}
      user={user}
      userName={getDisplayName(user)}
      onUserUpdate={handleUserUpdate}
      onLogout={handleLogout}
    />
  );
}

export default App;
