import React, { FormEvent, useEffect, useState } from 'react';
import './App.css';

type AppRoute = 'login' | 'register' | 'greenhouses' | 'notifications' | 'profile';

type User = {
  id: number;
  email: string;
  full_name?: string;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

const navItems: Array<{ label: string; path: string; route: AppRoute }> = [
  { label: 'Теплицы', path: '#/greenhouses', route: 'greenhouses' },
  { label: 'Уведомления', path: '#/notifications', route: 'notifications' },
  { label: 'Профиль', path: '#/profile', route: 'profile' },
];

const routeTitles: Record<AppRoute, string> = {
  login: 'Вход',
  register: 'Регистрация',
  greenhouses: 'Теплицы',
  notifications: 'Уведомления',
  profile: 'Профиль',
};

function getRouteFromHash(hash: string): AppRoute {
  const path = hash.replace(/^#\/?/, '');

  if (path.startsWith('register')) return 'register';
  if (path.startsWith('notifications')) return 'notifications';
  if (path.startsWith('profile')) return 'profile';
  if (path.startsWith('greenhouses')) return 'greenhouses';
  return 'login';
}

function getStoredUser(): User | null {
  const rawUser = localStorage.getItem('user');
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as User;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

function getDisplayName(user: User | null) {
  if (!user) return 'Пользователь';
  return user.full_name?.trim() || user.email;
}

async function getErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  const detail = payload?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(', ') || fallback;
  }

  if (typeof detail === 'string') {
    return detail;
  }

  return fallback;
}

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
      userName={getDisplayName(user)}
      onLogout={handleLogout}
    />
  );
}

function LoginPage({
  successMessage,
  onLogin,
}: {
  successMessage: string;
  onLogin: (token: string, user: User) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: email,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Не удалось войти. Проверьте email и пароль.'));
      }

      const data = (await response.json()) as LoginResponse;
      onLogin(data.access_token, data.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Ошибка входа.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-copy" aria-label="Описание сервиса">
        <p>Умная теплица</p>
        <h2>Автоматическое проветривание, контроль климата и удалённое управление.</h2>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">Умная теплица</p>
        <h1 id="auth-title">Вход</h1>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="user@mail.com"
              required
            />
          </label>
          <label>
            Пароль
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Введите пароль"
              required
            />
          </label>
          {successMessage && <p className="form-success">{successMessage}</p>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-action" type="submit" disabled={isLoading}>
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className="auth-switch">
          Нет аккаунта? <a href="#/register">Зарегистрироваться</a>
        </p>
      </section>
    </main>
  );
}

function RegisterPage({ onRegister }: { onRegister: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          full_name: fullName.trim(),
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Не удалось зарегистрироваться.'));
      }

      onRegister();
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Ошибка регистрации.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-copy" aria-label="Описание сервиса">
        <p>Умная теплица</p>
        <h2>Автоматическое проветривание, контроль климата и удалённое управление.</h2>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">Умная теплица</p>
        <h1 id="auth-title">Регистрация</h1>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Имя
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              type="text"
              placeholder="Иван Петров"
              required
            />
          </label>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="user@mail.com"
              required
            />
          </label>
          <label>
            Пароль
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Минимум 6 символов"
              minLength={6}
              required
            />
          </label>
          <label>
            Повтор пароля
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              placeholder="Повторите пароль"
              minLength={6}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-action" type="submit" disabled={isLoading}>
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="auth-switch">
          Уже есть аккаунт? <a href="#/login">Войти</a>
        </p>
      </section>
    </main>
  );
}

function AppLayout({
  route,
  userName,
  onLogout,
}: {
  route: AppRoute;
  userName: string;
  onLogout: () => void;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Основная навигация">
        <div>
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <span className="brand-name">Умная теплица</span>
              <span>Панель управления</span>
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
      </main>
    </div>
  );
}

export default App;
