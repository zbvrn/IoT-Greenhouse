function translateErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  if (normalized.includes('thingsboard rpc request failed (503)')) {
    return 'Устройство сейчас не подключено к каналу управления. Проверьте его подключение и попробуйте снова.';
  }

  if (
    normalized.includes('thingsboard rpc request failed (504)') ||
    (normalized.includes('rpc') && normalized.includes('timeout'))
  ) {
    return 'Устройство не ответило на команду вовремя. Проверьте его подключение и попробуйте снова.';
  }

  if (normalized.includes('thingsboard rpc request failed (404)')) {
    return 'Устройство не найдено в ThingsBoard. Проверьте номер устройства.';
  }

  if (
    normalized.includes('thingsboard rpc request failed (401)') ||
    normalized.includes('thingsboard rpc request failed (403)')
  ) {
    return 'Серверу не удалось авторизоваться в ThingsBoard. Попробуйте позже.';
  }

  if (
    normalized.includes('failed to send rpc request to thingsboard') ||
    normalized.includes('failed to send rpc request: failed to authenticate against thingsboard')
  ) {
    return 'Сейчас нет связи с ThingsBoard. Попробуйте отправить команду позже.';
  }

  const translations: Record<string, string> = {
    'incorrect email or password': 'Неверный email или пароль.',
    'invalid authentication credentials': 'Сессия истекла. Войдите заново.',
    'not authenticated': 'Сессия истекла. Войдите заново.',
    'user not found for provided token': 'Сессия истекла. Войдите заново.',
    'user with this email already exists': 'Пользователь с таким email уже существует.',
    'greenhouse not found': 'Теплица не найдена.',
    'greenhouse not found for current user': 'Теплица не найдена.',
    'device not found for current user': 'Устройство не найдено.',
    'device with this serial number already exists': 'Устройство с таким серийным номером уже существует.',
    'device not registered on thingsboard': 'Устройство не найдено в ThingsBoard.',
    'thingsboard configuration missing': 'Не настроена интеграция ThingsBoard.',
    'thingsboard url is not configured': 'Не задан адрес ThingsBoard.',
    'failed to contact thingsboard': 'Не удалось связаться с ThingsBoard.',
    'failed to authenticate against thingsboard': 'Не удалось авторизоваться в ThingsBoard.',
    'thingsboard login response did not return a token': 'Не удалось получить токен авторизации от ThingsBoard.',
    'field required': 'Заполните обязательные поля.',
    'value is not a valid email address': 'Введите корректный email.',
    'input should be a valid email address': 'Введите корректный email.',
    'string should have at least 6 characters': 'Пароль должен быть не короче 6 символов.',
  };

  if (translations[normalized]) {
    return translations[normalized];
  }

  return /[A-Za-z]/.test(message) ? 'Произошла ошибка. Попробуйте ещё раз.' : message;
}

export async function getErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  const detail = payload?.detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item?.msg === 'string' ? translateErrorMessage(item.msg) : ''))
      .filter(Boolean);
    return messages.join(', ') || fallback;
  }

  if (typeof detail === 'string') {
    return translateErrorMessage(detail);
  }

  return fallback;
}

export function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.';
  }

  return error instanceof Error ? error.message : fallback;
}
