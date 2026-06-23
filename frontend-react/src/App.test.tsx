import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/login';
  jest.restoreAllMocks();
});

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

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

test('renders app navigation for authenticated user', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' })
  );
  window.location.hash = '#/greenhouses';
  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = getRequestUrl(input);

    if (url.includes('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: 'Южная теплица',
            location: 'Участок 12',
            is_active: true,
            metadata: null,
            created_at: '2026-06-01T10:00:00Z',
            updated_at: '2026-06-09T10:00:00Z',
            user_id: 1,
          },
        ],
      } as Response);
    }

    if (url.includes('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  expect(screen.getByRole('link', { name: 'Теплицы' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Уведомления' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Профиль' })).toBeInTheDocument();
  expect(screen.getByText('Иван Петров')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
  expect(screen.queryByText('Панель управления')).not.toBeInTheDocument();
  expect(screen.getByText('Загружаем теплицы и устройства...')).toBeInTheDocument();
  await screen.findByRole('heading', { name: 'Теплицы' });
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

test('renders greenhouse list page with helper panels', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' })
  );
  window.location.hash = '#/greenhouses';
  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = getRequestUrl(input);

    if (url.includes('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: 'Южная теплица',
            location: 'Участок 12',
            is_active: true,
            metadata: null,
            created_at: '2026-06-01T10:00:00Z',
            updated_at: '2026-06-09T10:00:00Z',
            user_id: 1,
          },
        ],
      } as Response);
    }

    if (url.includes('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 11,
            name: 'Форточка север',
            serial_number: 'GH-001',
            is_active: true,
            last_seen: '2026-06-09T10:00:00Z',
            metadata: { device_type: 'window_opener', capabilities: ['open', 'close'] },
            greenhouse_id: null,
            user_id: 1,
          },
        ],
      } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  await screen.findByRole('heading', { name: 'Теплицы' });
  expect(screen.getByRole('heading', { name: 'Новая теплица' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Нераспределённые устройства' })).toBeInTheDocument();
  expect(screen.getAllByText('Южная теплица').length).toBeGreaterThan(0);
  expect(screen.getByText('Форточка север')).toBeInTheDocument();
  expect(screen.getByText(/Система проверит, зарегистрировано ли устройство/)).toBeInTheDocument();
});

test('renders greenhouse detail page with automation and devices', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' })
  );
  window.location.hash = '#/greenhouses/1';
  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = getRequestUrl(input);

    if (url.endsWith('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: 'Южная теплица',
            location: 'Участок 12',
            is_active: true,
            metadata: null,
            created_at: '2026-06-01T10:00:00Z',
            updated_at: '2026-06-09T10:00:00Z',
            user_id: 1,
          },
        ],
      } as Response);
    }

    if (url.endsWith('/api/greenhouses/1')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 1,
          name: 'Южная теплица',
          location: 'Участок 12',
          is_active: true,
          metadata: null,
          created_at: '2026-06-01T10:00:00Z',
          updated_at: '2026-06-09T10:00:00Z',
          user_id: 1,
        }),
      } as Response);
    }

    if (url.endsWith('/api/greenhouses/1/automation/')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 1,
          greenhouse_id: 1,
          auto_mode: true,
          target_temperature: 26,
          hysteresis: 2,
          last_action: 'open',
          last_action_at: '2026-06-09T10:00:00Z',
          updated_at: '2026-06-09T10:00:00Z',
        }),
      } as Response);
    }

    if (url.endsWith('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 11,
            name: 'Форточка север',
            serial_number: 'GH-001',
            is_active: true,
            last_seen: '2026-06-09T10:00:00Z',
            metadata: { device_type: 'window_opener', capabilities: ['open', 'close'] },
            greenhouse_id: 1,
            user_id: 1,
          },
        ],
      } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Южная теплица' })).toBeInTheDocument();
  });
  expect(screen.getByRole('heading', { name: 'Сведения о теплице' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Автоматика' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Устройства теплицы' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Как подключить устройство' })).toBeInTheDocument();
  expect(screen.getByText('Форточка север')).toBeInTheDocument();
});

test('renders manifest greenhouse page with live telemetry', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' })
  );
  window.location.hash = '#/greenhouses-new/1';
  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = getRequestUrl(input);

    if (url.endsWith('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: 'Южная теплица',
            location: 'Участок 12',
            is_active: true,
            metadata: null,
            created_at: '2026-06-01T10:00:00Z',
            updated_at: '2026-06-09T10:00:00Z',
            user_id: 1,
          },
        ],
      } as Response);
    }

    if (url.endsWith('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 11,
            name: 'Датчик климата',
            serial_number: 'SENSOR-001',
            is_active: true,
            last_seen: '2026-06-23T10:00:00Z',
            metadata: { device_type: 'sensor' },
            greenhouse_id: 1,
            user_id: 1,
          },
        ],
      } as Response);
    }

    if (url.endsWith('/api/telemetry/11')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          device_id: 11,
          serial_number: 'SENSOR-001',
          retrieved_at: '2026-06-23T10:00:00Z',
          telemetry: {
            temperature: [{ ts: 10, value: '24.6' }],
            humidity: [{ ts: 10, value: '61' }],
          },
        }),
      } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  await screen.findByRole('heading', { name: 'Южная теплица' });
  expect(screen.getByText('24.6 °C')).toBeInTheDocument();
  expect(screen.getByText('61 %')).toBeInTheDocument();
  expect(screen.getByText(/последние данные/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Параметры управления' })).toBeInTheDocument();
});

test('sends actuator command from manifest greenhouse page', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  window.location.hash = '#/greenhouses-new/1';
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url = getRequestUrl(input);

    if (url.endsWith('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: 'Южная теплица',
            is_active: true,
            metadata: null,
            created_at: '2026-06-01T10:00:00Z',
            updated_at: '2026-06-09T10:00:00Z',
            user_id: 1,
          },
        ],
      } as Response);
    }

    if (url.endsWith('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 12,
            name: 'Привод форточки',
            serial_number: 'ACT-001',
            is_active: true,
            last_seen: null,
            metadata: { device_type: 'actuator' },
            greenhouse_id: 1,
            user_id: 1,
          },
        ],
      } as Response);
    }

    if (url.endsWith('/api/telemetry/12')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          device_id: 12,
          serial_number: 'ACT-001',
          retrieved_at: '2026-06-23T10:00:00Z',
          telemetry: {
            status: [{ ts: 10, value: 'closed' }],
            temperature: [{ ts: 9, value: '22.5' }],
            humidity: [{ ts: 9, value: '65' }],
          },
        }),
      } as Response);
    }

    if (url.endsWith('/api/rpc/12') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ message: 'RPC request sent successfully' }),
      } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);
  const openButton = await screen.findByRole('button', { name: 'Открыть' });
  expect(screen.getByText('22.5 °C')).toBeInTheDocument();
  expect(screen.getByText('65 %')).toBeInTheDocument();
  fireEvent.click(openButton);

  await screen.findByText('Команда «Открыть» отправлена устройству.');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/rpc/12',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        method: 'setActuatorState',
        params: { state: 'open' },
      }),
    })
  );
});

test('creates greenhouse from modal on new greenhouse page', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  window.location.hash = '#/greenhouses-new';
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url = getRequestUrl(input);

    if (url.endsWith('/api/greenhouses/') && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 2,
          name: 'Теплица у дома',
          location: 'Южная сторона',
          is_active: true,
          metadata: null,
          created_at: '2026-06-23T10:00:00Z',
          updated_at: '2026-06-23T10:00:00Z',
          user_id: 1,
        }),
      } as Response);
    }

    if (url.endsWith('/api/greenhouses/')) {
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }

    if (url.endsWith('/api/devices/')) {
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  const addButton = await screen.findByRole('button', { name: 'Добавить теплицу' });
  fireEvent.click(addButton);

  const dialog = screen.getByRole('dialog', { name: 'Добавить теплицу' });
  fireEvent.change(within(dialog).getByPlaceholderText('Например, Теплица у дома'), {
    target: { value: 'Теплица у дома' },
  });
  fireEvent.change(within(dialog).getByPlaceholderText('Например, Южная сторона участка'), {
    target: { value: 'Южная сторона' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить теплицу' }));

  await screen.findByRole('heading', { name: 'Теплица у дома' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/greenhouses/',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Теплица у дома', location: 'Южная сторона' }),
    })
  );
});

test('redirects to login when stored token is invalid', async () => {
  localStorage.setItem('access_token', 'expired-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' })
  );
  window.location.hash = '#/profile';
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ detail: 'Invalid authentication credentials' }),
  } as Response);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Вход' })).toBeInTheDocument();
  });
  expect(screen.getByText('Сессия истекла. Войдите заново.')).toBeInTheDocument();
  expect(screen.queryByText('Invalid authentication credentials')).not.toBeInTheDocument();
  expect(localStorage.getItem('access_token')).toBeNull();
  expect(localStorage.getItem('user')).toBeNull();
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
