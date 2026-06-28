import { getRequestErrorMessage } from '../../../utils/errors';

export function getFriendlyError(error: unknown, fallback: string) {
  const message = getRequestErrorMessage(error, fallback);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('устройство не найдено в thingsboard') ||
    normalized.includes('device not registered')
  ) {
    return 'Похоже, это не ваше устройство или номер указан неверно. Проверьте номер и попробуйте ещё раз.';
  }

  if (
    normalized.includes('thingsboard') ||
    normalized.includes('нет связи с сервером') ||
    normalized.includes('failed to fetch')
  ) {
    return 'Попробуйте позже: сейчас не удалось связаться с ThingsBoard или сервером.';
  }

  if (normalized.includes('заполните') || normalized.includes('field required')) {
    return 'Заполните обязательные поля для сохранения.';
  }

  return message || fallback;
}
