import { getErrorMessage } from './errors';

function errorResponse(detail: string) {
  return {
    json: async () => ({ detail }),
  } as Response;
}

test('explains when a device cannot receive an RPC command', async () => {
  const message = await getErrorMessage(
    errorResponse(
      'Failed to send RPC request: ThingsBoard RPC request failed (503): ' +
        '{"message":null,"errorCode":2,"status":503}'
    ),
    'Не удалось отправить команду.'
  );

  expect(message).toBe(
    'Устройство сейчас не подключено к каналу управления. Проверьте его подключение и попробуйте снова.'
  );
});

test('distinguishes an RPC timeout from an unavailable device', async () => {
  const message = await getErrorMessage(
    errorResponse('Failed to send RPC request: ThingsBoard RPC request failed (504): timeout'),
    'Не удалось отправить команду.'
  );

  expect(message).toBe(
    'Устройство не ответило на команду вовремя. Проверьте его подключение и попробуйте снова.'
  );
});
