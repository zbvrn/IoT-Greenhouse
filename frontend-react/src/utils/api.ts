import { getErrorMessage } from './errors';

export class AuthExpiredError extends Error {
  constructor() {
    super('AUTH_EXPIRED');
    this.name = 'AuthExpiredError';
  }
}

type ApiRequestOptions = RequestInit & {
  fallbackError?: string;
  onAuthExpired?: () => void;
};

export async function requestJson<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { fallbackError = 'Произошла ошибка.', onAuthExpired, ...init } = options;
  const response = await fetch(url, init);

  if (response.status === 401 || response.status === 403) {
    onAuthExpired?.();
    throw new AuthExpiredError();
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackError));
  }

  return (await response.json()) as T;
}

export async function requestVoid(
  url: string,
  options: ApiRequestOptions = {}
): Promise<void> {
  const { fallbackError = 'Произошла ошибка.', onAuthExpired, ...init } = options;
  const response = await fetch(url, init);

  if (response.status === 401 || response.status === 403) {
    onAuthExpired?.();
    throw new AuthExpiredError();
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackError));
  }
}

export function isAuthExpiredError(error: unknown) {
  return error instanceof AuthExpiredError;
}
