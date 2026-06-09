import { FormEvent, useState } from 'react';
import type { LoginResponse, User } from '../types';
import { getErrorMessage, getRequestErrorMessage } from '../utils/errors';

type LoginPageProps = {
  successMessage: string;
  onLogin: (token: string, user: User) => void;
};

function LoginPage({ successMessage, onLogin }: LoginPageProps) {
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
      setError(getRequestErrorMessage(loginError, 'Ошибка входа.'));
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

export default LoginPage;
