import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/login';
  jest.restoreAllMocks();
});

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
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

test('signs the user in immediately after registration', async () => {
  window.location.hash = '#/register';
  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = getRequestUrl(input);
    if (url.endsWith('/api/auth/register')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 7, email: 'new@mail.com', full_name: 'Новый пользователь' }),
      } as Response);
    }
    if (url.endsWith('/api/auth/login')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          token_type: 'bearer',
          user: { id: 7, email: 'new@mail.com', full_name: 'Новый пользователь' },
        }),
      } as Response);
    }
    if (url.endsWith('/api/greenhouses/') || url.endsWith('/api/devices/')) {
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);
  fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Новый пользователь' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@mail.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secret12' } });
  fireEvent.change(screen.getByLabelText('Повтор пароля'), { target: { value: 'secret12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

  await screen.findByRole('heading', { name: 'Мои теплицы' });
  expect(localStorage.getItem('access_token')).toBe('new-token');
  expect(window.location.hash).toBe('#/my-greenhouses');
});

test('renders only the current application sections for an authenticated user', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 1, email: 'user@mail.com', full_name: 'Иван Петров' })
  );
  window.location.hash = '#/my-greenhouses';

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
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  await screen.findByRole('heading', { name: 'Мои теплицы' });
  expect(screen.getByRole('heading', { name: 'Южная теплица' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Мои теплицы' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Уведомления' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Профиль' })).toBeInTheDocument();
  expect(within(screen.getByRole('navigation')).getAllByRole('link')).toHaveLength(3);
  expect(screen.getByText('Иван Петров')).toBeInTheDocument();
});

test('resets the device type filter when another greenhouse is opened', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  window.location.hash = '#/my-greenhouses/1';

  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = getRequestUrl(input);
    if (url.endsWith('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 1, name: 'Первая теплица', location: null, is_active: true, metadata: null, created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z', user_id: 1 },
          { id: 2, name: 'Вторая теплица', location: null, is_active: true, metadata: null, created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z', user_id: 1 },
        ],
      } as Response);
    }
    if (url.endsWith('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 1, name: 'Контроллер', serial_number: 'DEV-1', is_active: true, last_seen: null, metadata: { device_type: 'other' }, greenhouse_id: 1, user_id: 1 },
          { id: 2, name: 'Термометр', serial_number: 'DEV-2', is_active: true, last_seen: null, metadata: { device_type: 'sensor' }, greenhouse_id: 2, user_id: 1 },
        ],
      } as Response);
    }
    if (url.includes('/api/telemetry/')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ device_id: 1, serial_number: 'DEV', retrieved_at: '2026-06-28T10:00:00Z', telemetry: {} }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);
  await screen.findByRole('heading', { name: 'Первая теплица' });
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: 'Отдельное устройство' }));
  expect(screen.getByRole('combobox')).toHaveTextContent('Отдельное устройство');

  window.location.hash = '#/my-greenhouses/2';
  fireEvent(window, new HashChangeEvent('hashchange'));

  await screen.findByRole('heading', { name: 'Вторая теплица' });
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Все'));
});

test('renders a controllable device with automation and telemetry history', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  window.location.hash = '#/my-greenhouses/1';

  jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
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
            id: 12,
            name: 'Привод северной форточки',
            serial_number: 'ACT-001',
            is_active: true,
            last_seen: null,
            metadata: {
              device_type: 'climate_control',
              sensor_type: 'temperature',
              actuator_type: 'linear_actuator',
              strokeLength: 250,
              strokeSpeed: 3,
            },
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
          retrieved_at: '2026-06-27T10:00:00Z',
          telemetry: {
            temperature: [{ ts: 1782554400000, value: null }],
            humidity: [{ ts: 1782554400000, value: null }],
            status: [{ ts: 1782554400000, value: null }],
            windowPosition: [
              { ts: 1782550800000, value: '40' },
              { ts: 1782554400000, value: '65' },
            ],
            actuatorOpenState: [{ ts: 1782554400000, value: true }],
          },
        }),
      } as Response);
    }

    if (url.endsWith('/api/rpc/12')) {
      if (String(init?.body).includes('"close"')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          text: async () => JSON.stringify({ message: null, errorCode: 2, status: 503 }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ message: 'Command accepted' }),
      } as Response);
    }

    if (url.endsWith('/api/devices/12') && init?.method === 'PUT') {
      const payload = JSON.parse(String(init.body));
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 12,
          name: payload.name,
          serial_number: 'ACT-001',
          is_active: true,
          last_seen: null,
          metadata: payload.metadata,
          greenhouse_id: payload.greenhouse_id || 1,
          user_id: 1,
        }),
      } as Response);
    }

    if (url.endsWith('/api/devices/12') && init?.method === 'DELETE') {
      return Promise.resolve({ ok: true, status: 204 } as Response);
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  const historyButton = await screen.findByRole('button', { name: 'История показаний' });
  expect(screen.getByRole('heading', { name: 'Автоматизация микроклимата' })).toBeInTheDocument();
  const automationSwitch = screen.getByRole('switch', {
    name: 'Автоматический режим: Управление температурой',
  });
  expect(automationSwitch).toBeEnabled();
  fireEvent.click(automationSwitch);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
  expect(await screen.findByText('Настройки сохранены и отправлены системе.')).toBeInTheDocument();
  const metricLabels = Array.from(document.querySelectorAll('.my-telemetry-grid dt')).map(
    (element) => element.textContent
  );
  expect(metricLabels.slice(0, 2)).toEqual(['Положение форточки', 'Состояние привода']);
  fireEvent.click(historyButton);
  const historyDialog = screen.getByRole('dialog');
  fireEvent.click(within(historyDialog).getByRole('combobox'));
  fireEvent.click(within(historyDialog).getByRole('option', { name: 'Положение форточки' }));
  expect(within(historyDialog).getByText('Доступно значений: 2')).toBeInTheDocument();
  expect(within(historyDialog).getByText('Растет ↑')).toBeInTheDocument();
  expect(within(historyDialog).getByTitle('История показателя «Положение форточки»')).toBeInTheDocument();
  fireEvent.click(within(historyDialog).getByRole('combobox'));
  expect(within(historyDialog).queryByRole('option', { name: 'Температура' })).not.toBeInTheDocument();
  fireEvent.click(historyDialog.querySelector('.my-modal__header button') as HTMLButtonElement);

  expect(screen.queryByRole('button', { name: 'Визуальное представление' })).not.toBeInTheDocument();
  const deviceCase = document.querySelector('.my-device-render__rugged-case');
  expect(deviceCase).not.toBeNull();
  expect(within(deviceCase as HTMLElement).getByText('Умная теплица')).toBeInTheDocument();
  expect(
    within(deviceCase as HTMLElement).getByText('Система контроля температуры и форточки')
  ).toBeInTheDocument();
  expect(screen.getAllByText('65 %').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Открыто').length).toBeGreaterThan(0);

  const deviceScreen = document.querySelector('.my-device-render__screen');
  expect(deviceScreen).not.toBeNull();
  expect(within(deviceScreen as HTMLElement).getByText('Положение форточки')).toBeInTheDocument();
  expect(within(deviceScreen as HTMLElement).getByText('Состояние привода')).toBeInTheDocument();

  fireEvent.click(within(deviceCase as HTMLElement).getByRole('button', { name: 'Открыть форточку' }));
  await screen.findByText('Команда отправлена устройству.');
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/rpc/12',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ method: 'setActuatorState', params: { state: 'open' } }),
    })
  );

  const deviceControls = within(deviceCase as HTMLElement).getByLabelText('Управление устройством');
  fireEvent.click(within(deviceControls).getByRole('button', { name: 'Закрыть форточку' }));
  const commandAlert = await screen.findByRole('alert');
  expect(commandAlert).toHaveTextContent('Попробуйте позже: сейчас не удалось связаться');
  fireEvent.click(within(commandAlert).getByRole('button', { name: 'Закрыть сообщение' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Настроить' }));
  const settingsDialog = screen.getByRole('dialog');
  fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Настроить' }));
  const nameInput = within(settingsDialog).getByLabelText('Название устройства *');
  expect(within(settingsDialog).getByLabelText('Ход привода')).toHaveValue(250);
  expect(within(settingsDialog).getByLabelText('Скорость привода')).toHaveValue(3);
  fireEvent.change(nameInput, { target: { value: 'Привод у входа' } });
  fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Сохранить' }));
  fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Закрыть' }));
  await screen.findByRole('heading', { name: 'Привод у входа' });
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/devices/12',
    expect.objectContaining({ method: 'PUT' })
  );

  fireEvent.click(screen.getByRole('button', { name: 'Настроить' }));
  const deleteDialog = screen.getByRole('dialog');
  fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Настроить' }));
  fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Удалить устройство' }));
  const openDialogs = screen.getAllByRole('dialog');
  const confirmationDialog = openDialogs[openDialogs.length - 1];
  expect(confirmationDialog).toHaveTextContent('снова добавить его, указав номер');
  fireEvent.click(within(confirmationDialog).getByRole('button', { name: 'Подтвердить удаление' }));
  await screen.findByText('К этой теплице пока не привязаны устройства.');
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/devices/12',
    expect.objectContaining({ method: 'DELETE' })
  );
});

test('deletes an empty greenhouse only after confirmation', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  window.location.hash = '#/my-greenhouses/1';

  jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url = getRequestUrl(input);
    if (url.endsWith('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{
          id: 1,
          name: 'Пустая теплица',
          location: 'Участок 3',
          is_active: true,
          metadata: null,
          created_at: '2026-06-01T10:00:00Z',
          updated_at: '2026-06-09T10:00:00Z',
          user_id: 1,
        }],
      } as Response);
    }
    if (url.endsWith('/api/devices/')) {
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }
    if (url.endsWith('/api/greenhouses/1') && init?.method === 'DELETE') {
      return Promise.resolve({ ok: true, status: 204 } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);
  await screen.findByRole('heading', { name: 'Пустая теплица' });
  fireEvent.click(screen.getByRole('button', { name: 'Удалить теплицу' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить теплицу' }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/greenhouses/1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
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
  await screen.findByRole('heading', { name: 'Иван Петров' });
  expect(screen.getByText('user@mail.com')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Изменить имя' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Смена пароля' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Выйти из аккаунта' })).toBeInTheDocument();
});

test('renders and deletes the welcome notification after registration', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  localStorage.setItem('greenhouse-welcome-pending:v2:1', 'true');
  window.location.hash = '#/notifications';

  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);

  render(<App />);

  expect(screen.getByRole('heading', { name: 'Уведомления' })).toBeInTheDocument();
  await screen.findByRole('heading', { name: 'Добро пожаловать в «Умную теплицу»' });
  expect(
    screen.getByRole('link', { name: 'Перейти в «Мои теплицы»' })
  ).toHaveAttribute('href', '#/my-greenhouses');
  expect(document.querySelector('.side-nav__notification-dot')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  expect(screen.getByText('Уведомлений пока нет.')).toBeInTheDocument();
});

test('creates one notification when the latest telemetry timestamp changes', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  localStorage.setItem('greenhouse-welcome-shown:v2:1', 'true');
  localStorage.setItem('greenhouse-telemetry-timestamps:v1:1', JSON.stringify({ 12: 1000 }));
  window.location.hash = '#/my-greenhouses';

  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = getRequestUrl(input);
    if (url.endsWith('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 4, name: 'Южная теплица' }],
      } as Response);
    }
    if (url.endsWith('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 12, name: 'Термометр', greenhouse_id: 4 }],
      } as Response);
    }
    if (url.endsWith('/api/telemetry/12')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ telemetry: { temperature: [{ ts: 2000, value: '24' }] } }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  await waitFor(() => {
    expect(document.querySelector('.side-nav__notification-dot')).toBeInTheDocument();
  });
  const stored = JSON.parse(
    localStorage.getItem('greenhouse-notifications:v1:1') || '[]'
  );
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({
    title: 'Новые данные: Термометр',
    targetHash: '#/my-greenhouses/4',
    read: false,
  });
});

test('does not notify when only an empty telemetry sample has a newer timestamp', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  localStorage.setItem('greenhouse-welcome-shown:v2:1', 'true');
  localStorage.setItem('greenhouse-telemetry-timestamps:v1:1', JSON.stringify({ 12: 2000 }));
  window.location.hash = '#/my-greenhouses';

  jest.spyOn(global, 'fetch').mockImplementation((input) => {
    const url = getRequestUrl(input);
    if (url.endsWith('/api/greenhouses/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 4, name: 'Южная теплица' }],
      } as Response);
    }
    if (url.endsWith('/api/devices/')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 12, name: 'Термометр', greenhouse_id: 4 }],
      } as Response);
    }
    if (url.endsWith('/api/telemetry/12')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          telemetry: {
            temperature: [{ ts: 2000, value: '24' }],
            humidity: [{ ts: 3000, value: null }],
          },
        }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(<App />);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/telemetry/12',
      expect.any(Object)
    );
  });
  expect(document.querySelector('.side-nav__notification-dot')).not.toBeInTheDocument();
  expect(
    JSON.parse(localStorage.getItem('greenhouse-notifications:v1:1') || '[]')
  ).toHaveLength(0);
});

test('removes the legacy welcome notification from an existing account', async () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  localStorage.setItem(
    'greenhouse-notifications:v1:1',
    JSON.stringify([{ id: 'welcome-v1', type: 'welcome', read: false }])
  );
  window.location.hash = '#/notifications';
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);

  render(<App />);

  await screen.findByText('Уведомлений пока нет.');
  expect(document.querySelector('.side-nav__notification-dot')).not.toBeInTheDocument();
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

  await screen.findByText('Неверный email или пароль.');
});
