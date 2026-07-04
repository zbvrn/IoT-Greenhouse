import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dropdown from '../../components/ui/Dropdown';
import {
  AssignDeviceForm,
  DeviceCreateForm,
  UnassignedDeviceCard,
} from '../../features/greenhouses/components/DeviceForms';
import { DeviceTelemetryPanel } from '../../features/greenhouses/components/DeviceTelemetryPanel';
import {
  DeleteGreenhouseConfirm,
  GreenhouseCard,
  GreenhouseForm,
} from '../../features/greenhouses/components/GreenhouseComponents';
import LoadingState from '../../features/greenhouses/components/LoadingState';
import Modal from '../../features/greenhouses/components/Modal';
import GreenhouseAutomationPanel from '../../features/greenhouses/components/GreenhouseAutomationPanel';
import { deviceKindFilterLabels } from '../../features/greenhouses/model/constants';
import {
  buildDeviceMetadata,
  getComponentRole,
  getDeviceKind,
  getSystemId,
  getSystemName,
} from '../../features/greenhouses/model/devices';
import { getFriendlyError } from '../../features/greenhouses/model/errors';
import { mergeDeviceTelemetry } from '../../features/greenhouses/model/telemetry';
import {
  groupDevicesIntoSystems,
  mergeSystemTelemetry,
} from '../../features/greenhouses/model/systems';
import type {
  DeviceCommand,
  DeviceKindFilter,
  DeviceUpdatePayload,
  ModalName,
} from '../../features/greenhouses/model/types';
import type { Device, DeviceTelemetry, Greenhouse, RouteState } from '../../types';
import { requestJson, requestVoid } from '../../utils/api';

type Props = {
  token: string;
  routeState: RouteState;
  onAuthExpired: () => void;
};

function MyGreenhousesPage({ token, routeState, onAuthExpired }: Props) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<number, DeviceTelemetry>>({});
  const [telemetryErrors, setTelemetryErrors] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');
  const [modal, setModal] = useState<ModalName>(null);
  const [deviceModalMode, setDeviceModalMode] = useState<'new' | 'assign'>('new');
  const [deviceKindFilter, setDeviceKindFilter] = useState<DeviceKindFilter>('all');
  const isAutoRefreshRunning = useRef(false);

  const selectedGreenhouse = greenhouses.find((item) => item.id === routeState.greenhouseId);
  const greenhouseDevices = selectedGreenhouse
    ? devices.filter((device) => device.greenhouse_id === selectedGreenhouse.id)
    : [];
  const greenhouseSystems = groupDevicesIntoSystems(greenhouseDevices);
  const filteredGreenhouseSystems =
    deviceKindFilter === 'all'
      ? greenhouseSystems
      : greenhouseSystems.filter((system) => system.kind === deviceKindFilter);
  const unassignedDevices = devices.filter((device) => device.greenhouse_id == null);
  const hasClimateControl = greenhouseDevices.some(
    (device) => getDeviceKind(device) === 'climate_control'
  );
  const hasSoilIrrigation = greenhouseDevices.some(
    (device) => getDeviceKind(device) === 'soil_irrigation'
  );

  const loadTelemetry = useCallback(
    async (deviceList: Device[], quiet = false) => {
      if (!quiet) setIsRefreshing(true);
      const results = await Promise.allSettled(
        deviceList.map((device) =>
          requestJson<DeviceTelemetry>(`/api/telemetry/${device.id}`, {
            headers,
            fallbackError: `Не удалось получить данные устройства «${device.name}».`,
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
          nextErrors[device.id] = getFriendlyError(
            result.reason,
            'Попробуйте позже: данные устройства сейчас недоступны.'
          );
        }
      });
      setTelemetry((current) => {
        const merged = { ...current };
        Object.entries(nextTelemetry).forEach(([deviceId, incoming]) => {
          const numericDeviceId = Number(deviceId);
          merged[numericDeviceId] = mergeDeviceTelemetry(
            current[numericDeviceId],
            incoming
          );
        });
        return merged;
      });
      setTelemetryErrors(nextErrors);
      setIsRefreshing(false);
    },
    [headers, onAuthExpired]
  );

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    setPageError('');
    try {
      const [greenhouseList, deviceList] = await Promise.all([
        requestJson<Greenhouse[]>('/api/greenhouses/', {
          headers,
          fallbackError: 'Попробуйте позже: список теплиц сейчас недоступен.',
          onAuthExpired,
        }),
        requestJson<Device[]>('/api/devices/', {
          headers,
          fallbackError: 'Попробуйте позже: список устройств сейчас недоступен.',
          onAuthExpired,
        }),
      ]);
      setGreenhouses(greenhouseList);
      setDevices(deviceList);
      if (routeState.route === 'my-greenhouse' && routeState.greenhouseId) {
        await loadTelemetry(
          deviceList.filter((device) => device.greenhouse_id === routeState.greenhouseId),
          true
        );
      } else {
        setTelemetryErrors({});
      }
    } catch (error) {
      setPageError(getFriendlyError(error, 'Попробуйте позже: страницу не удалось загрузить.'));
    } finally {
      setIsLoading(false);
    }
  }, [headers, loadTelemetry, onAuthExpired, routeState.greenhouseId, routeState.route]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    setDeviceKindFilter('all');
  }, [routeState.greenhouseId]);

  useEffect(() => {
    if (routeState.route !== 'my-greenhouse' || !routeState.greenhouseId) return;
    const devicesToRefresh = devices.filter(
      (device) => device.greenhouse_id === routeState.greenhouseId
    );
    if (!devicesToRefresh.length) return;

    const intervalId = window.setInterval(async () => {
      if (document.hidden || isAutoRefreshRunning.current) return;
      isAutoRefreshRunning.current = true;
      try {
        await loadTelemetry(devicesToRefresh, true);
      } finally {
        isAutoRefreshRunning.current = false;
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [devices, loadTelemetry, routeState.greenhouseId, routeState.route]);

  const closeModal = () => {
    setModal(null);
    setDeviceModalMode('new');
  };

  const createGreenhouse = async (payload: { name: string; location?: string }) => {
    const created = await requestJson<Greenhouse>('/api/greenhouses/', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      fallbackError: 'Попробуйте позже: теплицу не удалось создать.',
      onAuthExpired,
    });
    setGreenhouses((current) => [...current, created]);
    closeModal();
  };

  const updateGreenhouse = async (payload: { name: string; location?: string }) => {
    if (!selectedGreenhouse) return;
    const updated = await requestJson<Greenhouse>(`/api/greenhouses/${selectedGreenhouse.id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      fallbackError: 'Попробуйте позже: данные теплицы не удалось сохранить.',
      onAuthExpired,
    });
    setGreenhouses((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    closeModal();
  };

  const createDevice = async (payload: {
    name: string;
    serial_number: string;
    greenhouse_id?: number | null;
    metadata: Record<string, unknown>;
  }) => {
    const body = {
      name: payload.name,
      serial_number: payload.serial_number,
      metadata: payload.metadata,
      ...(payload.greenhouse_id ? { greenhouse_id: payload.greenhouse_id } : {}),
    };
    const created = await requestJson<Device>('/api/devices/', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      fallbackError: 'Попробуйте позже: устройство не удалось добавить.',
      onAuthExpired,
    });
    setDevices((current) => [...current, created]);
    await loadTelemetry([created], true);
    closeModal();
  };

  const assignDevice = async (deviceId: number, greenhouseId: number) => {
    const updated = await requestJson<Device>(`/api/devices/${deviceId}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ greenhouse_id: greenhouseId }),
      fallbackError: 'Попробуйте позже: устройство не удалось привязать.',
      onAuthExpired,
    });
    setDevices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    closeModal();
  };

  const updateDevice = async (device: Device, payload: DeviceUpdatePayload) => {
    const currentMetadata = device.metadata || device.device_metadata || {};
    const preservedMetadata = Object.fromEntries(
      Object.entries(currentMetadata).filter(
        ([key]) =>
          ![
            'device_type',
            'sensor_type',
            'actuator_type',
            'strokeLength',
            'strokeSpeed',
            'valveOpenPercent',
          ].includes(key)
      )
    );
    const updated = await requestJson<Device>(`/api/devices/${device.id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        metadata: {
          ...preservedMetadata,
          ...buildDeviceMetadata(payload.kind, {
            strokeLength: payload.strokeLength,
            strokeSpeed: payload.strokeSpeed,
            valveOpenPercent: payload.valveOpenPercent,
            componentRole: getComponentRole(device),
            systemId: getSystemId(device),
            systemName: getSystemName(device),
          }),
        },
        ...(payload.greenhouseId ? { greenhouse_id: payload.greenhouseId } : {}),
      }),
      fallbackError: 'Попробуйте позже: устройство не удалось сохранить.',
      onAuthExpired,
    });
    setDevices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const deleteDevice = async (device: Device) => {
    await requestVoid(`/api/devices/${device.id}`, {
      method: 'DELETE',
      headers,
      fallbackError: 'Попробуйте позже: устройство не удалось удалить.',
      onAuthExpired,
    });
    setDevices((current) => current.filter((item) => item.id !== device.id));
    setTelemetry((current) => {
      const next = { ...current };
      delete next[device.id];
      return next;
    });
    setTelemetryErrors((current) => {
      const next = { ...current };
      delete next[device.id];
      return next;
    });
  };

  const renameSystem = async (systemDevices: Device[], name: string) => {
    const updatedDevices = await Promise.all(
      systemDevices.map((device) => {
        const metadata = device.metadata || device.device_metadata || {};
        return requestJson<Device>(`/api/devices/${device.id}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: { ...metadata, system_name: name } }),
          fallbackError: 'Попробуйте позже: название системы не удалось сохранить.',
          onAuthExpired,
        });
      })
    );
    const updatesById = new Map(updatedDevices.map((device) => [device.id, device]));
    setDevices((current) => current.map((device) => updatesById.get(device.id) || device));
  };

  const deleteGreenhouse = async () => {
    if (!selectedGreenhouse || greenhouseDevices.length) return;
    await requestVoid(`/api/greenhouses/${selectedGreenhouse.id}`, {
      method: 'DELETE',
      headers,
      fallbackError: 'Попробуйте позже: теплицу не удалось удалить.',
      onAuthExpired,
    });
    setGreenhouses((current) => current.filter((item) => item.id !== selectedGreenhouse.id));
    closeModal();
    window.location.hash = '#/my-greenhouses';
  };

  const sendRpc = async (device: Device, method: string, params: Record<string, unknown>) => {
    await requestJson<{ message: string }>(`/api/rpc/${device.id}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params }),
      fallbackError: 'Попробуйте позже: команду не удалось отправить.',
      onAuthExpired,
    });
  };

  const sendCommand = async (device: Device, command: DeviceCommand) => {
    await sendRpc(device, 'setActuatorState', { state: command });
    window.setTimeout(() => loadTelemetry(greenhouseDevices, true), 1200);
  };

  if (isLoading) return <LoadingState />;

  if (pageError) {
    return (
      <section className="my-page">
        <div className="my-error-state">
          <h1>Мои теплицы</h1>
          <p>{pageError}</p>
          <button type="button" onClick={loadPage}>
            Повторить
          </button>
        </div>
      </section>
    );
  }

  if (routeState.route === 'my-greenhouse') {
    if (!selectedGreenhouse) {
      return (
        <section className="my-page">
          <div className="my-error-state">
            <h1>Теплица не найдена</h1>
            <a href="#/my-greenhouses">Вернуться к списку</a>
          </div>
        </section>
      );
    }

    return (
      <section className="my-page">
        <header className="my-page__header">
          <div>
            <a className="back-link" href="#/my-greenhouses">
              ← Мои теплицы
            </a>
            <h1>{selectedGreenhouse.name}</h1>
            <p>{selectedGreenhouse.location || 'Расположение не указано'}</p>
          </div>
          <div className="my-header-actions">
            <button className="secondary-action" type="button" onClick={() => setModal('greenhouse-edit')}>
              Редактировать
            </button>
            {!greenhouseDevices.length && (
              <button className="danger-action" type="button" onClick={() => setModal('greenhouse-delete')}>
                Удалить теплицу
              </button>
            )}
            <button type="button" onClick={() => setModal('device-add-menu')}>
              Добавить устройство
            </button>
          </div>
        </header>

        <div className="my-toolbar">
          <div>
            <strong>Устройства теплицы</strong>
            <span>Обновите данные, чтобы увидеть последние полученные показания.</span>
          </div>
          <div className="my-toolbar__actions">
            <button type="button" disabled={isRefreshing} onClick={() => loadTelemetry(greenhouseDevices)}>
              {isRefreshing ? 'Обновляем...' : 'Обновить данные'}
            </button>
          </div>
        </div>

        {greenhouseDevices.length ? (
          <>
            <div className="my-device-filter">
              <div className="my-device-filter__field">
                <span>Тип системы</span>
                <Dropdown
                  value={deviceKindFilter}
                  onChange={(value) => setDeviceKindFilter(value as DeviceKindFilter)}
                  placeholder="Все"
                  options={Object.entries(deviceKindFilterLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>
            </div>
            <div className="my-device-list">
              {filteredGreenhouseSystems.length ? (
                filteredGreenhouseSystems.map((system) => (
                  <DeviceTelemetryPanel
                    key={system.id}
                    device={system.primary}
                    displayName={system.devices.length > 1 ? system.name : system.primary.name}
                    componentCount={system.devices.length}
                    commandDevice={system.commandTarget}
                    systemDevices={system.devices}
                    onRenameSystem={(name) => renameSystem(system.devices, name)}
                    onConfigureActuator={async (settings) => {
                      if (!system.commandTarget) throw new Error('Контроллер системы не найден.');
                      await sendRpc(
                        system.commandTarget,
                        system.kind === 'soil_irrigation' ? 'setIrrigationConfig' : 'setActuatorConfig',
                        settings
                      );
                    }}
                    telemetry={mergeSystemTelemetry(system, telemetry)}
                    telemetryError={system.devices
                      .map((device) => telemetryErrors[device.id])
                      .filter(Boolean)
                      .join(' ')}
                    onCommand={sendCommand}
                    greenhouses={greenhouses}
                    onUpdate={updateDevice}
                    onDelete={deleteDevice}
                  />
                ))
              ) : (
                <p className="my-inline-warning">Устройств выбранного назначения в этой теплице нет.</p>
              )}
            </div>
          </>
        ) : (
          <div className="my-empty">
            <p>К этой теплице пока не привязаны устройства.</p>
            <button className="secondary-action" type="button" onClick={() => setModal('device-add-menu')}>
              Добавить устройство
            </button>
          </div>
        )}

        {(hasClimateControl || hasSoilIrrigation) && selectedGreenhouse && (
          <GreenhouseAutomationPanel
            key={selectedGreenhouse.id}
            greenhouseId={selectedGreenhouse.id}
            hasClimateControl={hasClimateControl}
            hasSoilIrrigation={hasSoilIrrigation}
            onSaveTemperature={async (draft) => {
              const targets = greenhouseSystems
                .filter((system) => system.kind === 'climate_control' && system.commandTarget)
                .map((system) => system.commandTarget as Device);
              if (!targets.length) throw new Error('Контроллер климатической системы не найден.');
              await Promise.all(
                targets.map((target) =>
                  sendRpc(target, 'setAutomationConfig', {
                    enabled: draft.enabled,
                    targetTemperature: draft.target,
                    hysteresis: draft.hysteresis,
                  })
                )
              );
            }}
            onSaveMoisture={async (draft) => {
              const targets = greenhouseSystems
                .filter((system) => system.kind === 'soil_irrigation' && system.commandTarget)
                .map((system) => system.commandTarget as Device);
              if (!targets.length) throw new Error('Контроллер системы полива не найден.');
              await Promise.all(
                targets.map((target) =>
                  sendRpc(target, 'setMoistureAutomationConfig', {
                    enabled: draft.enabled,
                    targetMoisture: draft.target,
                    hysteresis: draft.hysteresis,
                  })
                )
              );
            }}
          />
        )}

        {modal === 'greenhouse-edit' && (
          <Modal title="Редактировать теплицу" size="compact" onClose={closeModal}>
            <GreenhouseForm greenhouse={selectedGreenhouse} onSubmit={updateGreenhouse} />
          </Modal>
        )}

        {modal === 'greenhouse-delete' && (
          <Modal title="Удалить теплицу" size="compact" onClose={closeModal}>
            <DeleteGreenhouseConfirm greenhouse={selectedGreenhouse} onConfirm={deleteGreenhouse} />
          </Modal>
        )}

        {modal === 'device-add-menu' && (
          <Modal title="Добавить устройство" size="wide" onClose={closeModal}>
            <div className="my-segmented">
              <button
                className={deviceModalMode === 'new' ? 'active' : ''}
                type="button"
                onClick={() => setDeviceModalMode('new')}
              >
                Новое устройство
              </button>
              <button
                className={deviceModalMode === 'assign' ? 'active' : ''}
                type="button"
                onClick={() => setDeviceModalMode('assign')}
              >
                Из нераспределенных
              </button>
            </div>
            {deviceModalMode === 'new' ? (
              <DeviceCreateForm
                greenhouses={greenhouses}
                devices={devices}
                fixedGreenhouseId={selectedGreenhouse.id}
                onSubmit={createDevice}
              />
            ) : (
              <AssignDeviceForm
                devices={unassignedDevices}
                greenhouseId={selectedGreenhouse.id}
                onAssign={assignDevice}
              />
            )}
          </Modal>
        )}
      </section>
    );
  }

  return (
    <section className="my-page">
      <header className="my-page__header">
        <div>
          <h1>Мои теплицы</h1>
          <p>Создавайте теплицы, привязывайте к ним устройства и управляйте состоянием микроклимата.</p>
        </div>
        <button type="button" onClick={() => setModal('greenhouse-create')}>
          Добавить теплицу
        </button>
      </header>

      <div className="my-grid">
        <main className="my-greenhouse-area">
          {greenhouses.length ? (
            <div className="my-greenhouse-grid">
              {greenhouses.map((greenhouse) => (
                <GreenhouseCard key={greenhouse.id} greenhouse={greenhouse} />
              ))}
            </div>
          ) : (
            <div className="my-empty">
              <p>Теплиц пока нет.</p>
              <button type="button" onClick={() => setModal('greenhouse-create')}>
                Добавить теплицу
              </button>
            </div>
          )}
        </main>

        <aside className="my-unassigned-panel">
          <div className="my-panel-heading">
            <h2>Нераспределенные устройства</h2>
          </div>
          {unassignedDevices.length ? (
            <div className="my-unassigned-list">
              {unassignedDevices.map((device) => (
                <UnassignedDeviceCard
                  key={device.id}
                  device={device}
                  greenhouses={greenhouses}
                  onAssign={assignDevice}
                  onUpdate={updateDevice}
                  onDelete={deleteDevice}
                />
              ))}
            </div>
          ) : (
            <p className="my-muted">Нераспределенных устройств пока нет.</p>
          )}
          <button className="my-panel-action" type="button" onClick={() => setModal('device-create')}>
            Добавить устройство
          </button>
        </aside>
      </div>

      {modal === 'greenhouse-create' && (
        <Modal title="Добавить теплицу" size="compact" onClose={closeModal}>
          <GreenhouseForm onSubmit={createGreenhouse} />
        </Modal>
      )}

      {modal === 'device-create' && (
        <Modal title="Добавить устройство" size="wide" onClose={closeModal}>
          <DeviceCreateForm greenhouses={greenhouses} devices={devices} onSubmit={createDevice} />
        </Modal>
      )}
    </section>
  );
}

export default MyGreenhousesPage;
