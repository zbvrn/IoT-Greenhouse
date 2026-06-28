import { FormEvent, useState } from 'react';
import type { LoginResponse, User } from '../types';
import { getErrorMessage, getRequestErrorMessage } from '../utils/errors';

type RegisterPageProps = {
  onRegister: (token: string, user: User) => void;
};

function RegisterPage({ onRegister }: RegisterPageProps) {
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

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }

    if (!fullName.trim()) {
      setError('Введите имя.');
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

      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: email,
          password,
        }),
      });

      if (!loginResponse.ok) {
        throw new Error(
          await getErrorMessage(
            loginResponse,
            'Аккаунт создан, но автоматически войти не удалось. Перейдите на страницу входа.'
          )
        );
      }

      const loginData = (await loginResponse.json()) as LoginResponse;
      onRegister(loginData.access_token, loginData.user);
    } catch (registerError) {
      setError(getRequestErrorMessage(registerError, 'Ошибка регистрации.'));
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

export default RegisterPage;
