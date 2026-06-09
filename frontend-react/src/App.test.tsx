import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/login';
  jest.restoreAllMocks();
});

test('renders login screen with registration link', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Зарегистрироваться' })).toBeInTheDocument();
});

test('renders registration screen', () => {
  window.location.hash = '#/register';

  render(<App />);

  expect(screen.getByRole('heading', { name: 'Регистрация' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Войти' })).toBeInTheDocument();
});

test('renders app navigation for authenticated user', () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' })
  );
  window.location.hash = '#/greenhouses';

  render(<App />);

  expect(screen.getByRole('link', { name: 'Теплицы' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Уведомления' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Профиль' })).toBeInTheDocument();
  expect(screen.getByText('Иван Петров')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
  expect(screen.queryByText('Панель управления')).not.toBeInTheDocument();
});

test('renders profile page with account controls', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' })
  );
  window.location.hash = '#/profile';
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' }),
  } as Response);

  render(<App />);

  expect(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Иван Петров' })).toBeInTheDocument();
  });
  expect(screen.getByText('user@mail.com')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Изменить имя' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Смена пароля' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Минимум 6 символов')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Выйти из аккаунта' })).toBeInTheDocument();
});

test('translates login API errors to Russian', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    json: async () => ({ detail: 'Incorrect email or password' }),
  } as Response);

  render(<App />);

  fireEvent.change(screen.getByPlaceholderText('user@mail.com'), {
    target: { value: 'user@mail.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Введите пароль'), {
    target: { value: 'wrong-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

  await waitFor(() => {
    expect(screen.getByText('Неверный email или пароль.')).toBeInTheDocument();
  });
});
