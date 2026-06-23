import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Device, DeviceTelemetry, Greenhouse } from '../../types';
import { requestJson } from '../../utils/api';
import { getRequestErrorMessage } from '../../utils/errors';

type Args = {
  token: string;
  onAuthExpired: () => void;
};

export function useManifestGreenhouses({ token, onAuthExpired }: Args) {
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<number, DeviceTelemetry>>({});
  const [telemetryErrors, setTelemetryErrors] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadTelemetry = useCallback(
    async (deviceList: Device[], quiet = false) => {
      if (!quiet) setIsRefreshing(true);
      const results = await Promise.allSettled(
        deviceList.map((device) =>
          requestJson<DeviceTelemetry>(`/api/telemetry/${device.id}`, {
            headers,
            fallbackError: `Не удалось получить телеметрию устройства «${device.name}».`,
            onAuthExpired,
          })
        )
      );

      const nextTelemetry: Record<number, DeviceTelemetry> = {};
      const nextErrors: Record<number, string> = {};
      results.forEach((result, index) => {
        const device = deviceList[index];
        if (result.status === 'fulfilled') {
          nextTelemetry[device.id] = result.value;
        } else {
          nextErrors[device.id] = getRequestErrorMessage(
            result.reason,
            'Телеметрия временно недоступна.'
          );
        }
      });
      setTelemetry((current) => ({ ...current, ...nextTelemetry }));
      setTelemetryErrors(nextErrors);
      setIsRefreshing(false);
    },
    [headers, onAuthExpired]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [greenhouseList, deviceList] = await Promise.all([
        requestJson<Greenhouse[]>('/api/greenhouses/', {
          headers,
          fallbackError: 'Не удалось загрузить теплицы.',
          onAuthExpired,
        }),
        requestJson<Device[]>('/api/devices/', {
          headers,
          fallbackError: 'Не удалось загрузить устройства.',
          onAuthExpired,
        }),
      ]);
      setGreenhouses(greenhouseList);
      setDevices(deviceList);
      await loadTelemetry(deviceList, true);
    } catch (error) {
      setLoadError(getRequestErrorMessage(error, 'Не удалось загрузить систему управления.'));
    } finally {
      setIsLoading(false);
    }
  }, [headers, loadTelemetry, onAuthExpired]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!devices.length) return undefined;
    const interval = window.setInterval(() => loadTelemetry(devices, true), 30000);
    return () => window.clearInterval(interval);
  }, [devices, loadTelemetry]);

  const saveDeviceParameters = useCallback(
    async (device: Device, values: Record<string, number>) => {
      const metadata = {
        ...(device.metadata || {}),
        manifest_params: {
          ...((device.metadata?.manifest_params as Record<string, unknown> | undefined) || {}),
          ...values,
        },
      };
      const updated = await requestJson<Device>(`/api/devices/${device.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata }),
        fallbackError: 'Не удалось сохранить параметры устройства.',
        onAuthExpired,
      });
      setDevices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      return updated;
    },
    [headers, onAuthExpired]
  );

  const createDevice = useCallback(
    async (payload: {
      name: string;
      serial_number: string;
      greenhouse_id: number;
      metadata: Record<string, unknown>;
    }) => {
      const created = await requestJson<Device>('/api/devices/', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        fallbackError:
          'Не удалось добавить устройство. Проверьте его номер и подключение к системе.',
        onAuthExpired,
      });
      setDevices((current) => [...current, created]);
      await loadTelemetry([created], true);
      return created;
    },
    [headers, loadTelemetry, onAuthExpired]
  );

  const createGreenhouse = useCallback(
    async (payload: { name: string; location?: string }) => {
      const created = await requestJson<Greenhouse>('/api/greenhouses/', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        fallbackError: 'Не удалось добавить теплицу.',
        onAuthExpired,
      });
      setGreenhouses((current) => [...current, created]);
      return created;
    },
    [headers, onAuthExpired]
  );

  const sendCommand = useCallback(
    async (device: Device, command: 'open' | 'close' | 'stop') => {
      await requestJson<{ message: string }>(`/api/rpc/${device.id}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'setActuatorState',
          params: { state: command },
        }),
        fallbackError: `Не удалось отправить команду «${command}».`,
        onAuthExpired,
      });
      window.setTimeout(() => loadTelemetry([device], true), 1200);
    },
    [headers, loadTelemetry, onAuthExpired]
  );

  return {
    createDevice,
    createGreenhouse,
    devices,
    greenhouses,
    isLoading,
    isRefreshing,
    loadError,
    refreshTelemetry: () => loadTelemetry(devices),
    saveDeviceParameters,
    sendCommand,
    telemetry,
    telemetryErrors,
  };
}
