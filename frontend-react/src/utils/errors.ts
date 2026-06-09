function translateErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  const translations: Record<string, string> = {
    'incorrect email or password': 'Неверный email или пароль.',
    'user with this email already exists': 'Пользователь с таким email уже существует.',
    'field required': 'Заполните обязательные поля.',
    'value is not a valid email address': 'Введите корректный email.',
    'input should be a valid email address': 'Введите корректный email.',
    'string should have at least 6 characters': 'Пароль должен быть не короче 6 символов.',
  };

  return translations[normalized] || message;
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
