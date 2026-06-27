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

test('opens a live visual representation for a greenhouse device', async () => {
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
  fireEvent.click(historyButton);
  const historyDialog = screen.getByRole('dialog');
  fireEvent.click(within(historyDialog).getByRole('combobox'));
  fireEvent.click(within(historyDialog).getByRole('option', { name: 'Положение форточки' }));
  expect(within(historyDialog).getByText('Доступно значений: 2')).toBeInTheDocument();
  expect(within(historyDialog).getByText('Растет ↑')).toBeInTheDocument();
  expect(within(historyDialog).getByTitle('История показателя «Положение форточки»')).toBeInTheDocument();
  fireEvent.click(within(historyDialog).getByRole('combobox'));
  fireEvent.click(within(historyDialog).getByRole('option', { name: 'Температура' }));
  expect(within(historyDialog).getByText('Для этого показателя пока нет полученных значений.')).toBeInTheDocument();
  expect(within(historyDialog).queryByRole('table')).not.toBeInTheDocument();
  fireEvent.click(historyDialog.querySelector('.my-modal__header button') as HTMLButtonElement);

  const visualButton = await screen.findByRole('button', { name: 'Визуальное представление' });
  fireEvent.click(visualButton);

  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Умная теплица')).toBeInTheDocument();
  const deviceCase = dialog.querySelector('.my-device-render__rugged-case');
  expect(deviceCase).not.toBeNull();
  expect(within(deviceCase as HTMLElement).getByText('Привод форточки')).toBeInTheDocument();
  expect(within(dialog).getAllByText('65 %').length).toBeGreaterThan(0);
  expect(within(dialog).getAllByText('Открыто').length).toBeGreaterThan(0);

  const deviceScreen = dialog.querySelector('.my-device-render__screen');
  expect(deviceScreen).not.toBeNull();
  expect(within(deviceScreen as HTMLElement).getByText('Положение форточки')).toBeInTheDocument();
  expect(within(deviceScreen as HTMLElement).getByText('Состояние привода')).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Открыть' }));
  await screen.findByText('Команда отправлена устройству.');
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/rpc/12',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ method: 'setActuatorState', params: { state: 'open' } }),
    })
  );

  const deviceControls = within(dialog).getByLabelText('Управление устройством');
  fireEvent.click(within(deviceControls).getByRole('button', { name: 'Закрыть' }));
  const commandAlert = await within(dialog).findByRole('alert');
  expect(commandAlert).toHaveTextContent('Попробуйте позже: сейчас не удалось связаться');
  fireEvent.click(within(commandAlert).getByRole('button', { name: 'Закрыть сообщение' }));
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(dialog.querySelector('.my-modal__header button') as HTMLButtonElement);

  fireEvent.click(screen.getByRole('button', { name: 'Настроить' }));
  const settingsDialog = screen.getByRole('dialog');
  const nameInput = within(settingsDialog).getByLabelText('Название устройства *');
  fireEvent.change(nameInput, { target: { value: 'Привод у входа' } });
  fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Сохранить' }));
  await screen.findByRole('heading', { name: 'Привод у входа' });
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/devices/12',
    expect.objectContaining({ method: 'PUT' })
  );

  fireEvent.click(screen.getByRole('button', { name: 'Настроить' }));
  const deleteDialog = screen.getByRole('dialog');
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

test('renders notifications placeholder', () => {
  localStorage.setItem('access_token', 'demo-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'user@mail.com' }));
  window.location.hash = '#/notifications';

  render(<App />);

  expect(screen.getByRole('heading', { name: 'Уведомления' })).toBeInTheDocument();
  expect(screen.getByText('Раздел находится в разработке.')).toBeInTheDocument();
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
