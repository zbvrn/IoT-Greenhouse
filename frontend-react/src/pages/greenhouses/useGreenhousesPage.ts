import { useCallback, useEffect, useState } from 'react';
import { requestJson, requestVoid } from '../../utils/api';
import { getRequestErrorMessage } from '../../utils/errors';
import type { AutomationSetting, Device, Greenhouse, RouteState } from '../../types';

type UseGreenhousesPageArgs = {
  token: string;
  routeState: RouteState;
  onAuthExpired: () => void;
};

export function useGreenhousesPage({
  token,
  routeState,
  onAuthExpired,
}: UseGreenhousesPageArgs) {
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedGreenhouse, setSelectedGreenhouse] = useState<Greenhouse | null>(null);
  const [automation, setAutomation] = useState<AutomationSetting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

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

      let greenhouseDetail: Greenhouse | null = null;
      let automationDetail: AutomationSetting | null = null;

      if (routeState.route === 'greenhouse' && routeState.greenhouseId) {
        [greenhouseDetail, automationDetail] = await Promise.all([
          requestJson<Greenhouse>(`/api/greenhouses/${routeState.greenhouseId}`, {
            headers,
            fallbackError: 'Не удалось загрузить теплицу.',
            onAuthExpired,
          }),
          requestJson<AutomationSetting>(
            `/api/greenhouses/${routeState.greenhouseId}/automation/`,
            {
              headers,
              fallbackError: 'Не удалось загрузить настройки автоматики.',
              onAuthExpired,
            }
          ),
        ]);
      }

      setGreenhouses(greenhouseList);
      setDevices(deviceList);
      setSelectedGreenhouse(greenhouseDetail);
      setAutomation(automationDetail);
    } catch (error) {
      setLoadError(getRequestErrorMessage(error, 'Не удалось загрузить теплицы.'));
    } finally {
      setIsLoading(false);
    }
  }, [onAuthExpired, routeState.greenhouseId, routeState.route, token]);

  useEffect(() => {
    load();
  }, [load]);

  const createGreenhouse = useCallback(
    async (payload: { name: string; location?: string }) => {
      const created = await requestJson<Greenhouse>('/api/greenhouses/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        fallbackError: 'Не удалось создать теплицу.',
        onAuthExpired,
      });
      await load();
      return created;
    },
    [load, onAuthExpired, token]
  );

  const updateGreenhouse = useCallback(
    async (greenhouseId: number, payload: { name?: string; location?: string; is_active?: boolean }) => {
      const updated = await requestJson<Greenhouse>(`/api/greenhouses/${greenhouseId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        fallbackError: 'Не удалось сохранить теплицу.',
        onAuthExpired,
      });
      await load();
      return updated;
    },
    [load, onAuthExpired, token]
  );

  const deleteGreenhouse = useCallback(
    async (greenhouseId: number) => {
      await requestVoid(`/api/greenhouses/${greenhouseId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        fallbackError: 'Не удалось удалить теплицу.',
        onAuthExpired,
      });
      await load();
    },
    [load, onAuthExpired, token]
  );

  const createDevice = useCallback(
    async (payload: {
      name: string;
      serial_number: string;
      greenhouse_id?: number | null;
    }) => {
      const created = await requestJson<Device>('/api/devices/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        fallbackError: 'Не удалось добавить устройство. Проверьте Device ID и попробуйте ещё раз.',
        onAuthExpired,
      });
      await load();
      return created;
    },
    [load, onAuthExpired, token]
  );

  const assignDevice = useCallback(
    async (deviceId: number, greenhouseId: number) => {
      await requestJson<Device>(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ greenhouse_id: greenhouseId }),
        fallbackError: 'Не удалось привязать устройство.',
        onAuthExpired,
      });
      await load();
    },
    [load, onAuthExpired, token]
  );

  const updateAutomation = useCallback(
    async (
      greenhouseId: number,
      payload: {
        auto_mode?: boolean;
        target_temperature?: number;
        hysteresis?: number;
      }
    ) => {
      const updated = await requestJson<AutomationSetting>(
        `/api/greenhouses/${greenhouseId}/automation/`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          fallbackError: 'Не удалось сохранить настройки автоматики.',
          onAuthExpired,
        }
      );
      await load();
      return updated;
    },
    [load, onAuthExpired, token]
  );

  return {
    assignDevice,
    automation,
    createDevice,
    createGreenhouse,
    deleteGreenhouse,
    devices,
    greenhouses,
    isLoading,
    loadError,
    reload: load,
    selectedGreenhouse,
    updateAutomation,
    updateGreenhouse,
  };
}
