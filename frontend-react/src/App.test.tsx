import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/login';
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
});
