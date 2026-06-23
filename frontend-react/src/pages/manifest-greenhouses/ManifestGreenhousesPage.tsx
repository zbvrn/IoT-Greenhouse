import { useEffect, useId, useMemo, useState } from 'react';
import type { Device, DeviceTelemetry, Greenhouse, RouteState } from '../../types';
import { getRequestErrorMessage } from '../../utils/errors';
import {
  formatTelemetryValue,
  getHistoricalStates,
  getDevicePresentation,
  getLatestTelemetryTimestamp,
  getLatestTelemetryValue,
  getStoredParameter,
  temperatureStates,
  type ManifestParameter,
} from './manifestModel';
import { useManifestGreenhouses } from './useManifestGreenhouses';

type Props = {
  token: string;
  routeState: RouteState;
  onAuthExpired: () => void;
};

type DevicePanelProps = {
  device: Device;
  telemetry?: DeviceTelemetry;
  telemetryError?: string;
  onSave: (device: Device, values: Record<string, number>) => Promise<Device>;
  onCommand: (device: Device, command: 'open' | 'close' | 'stop') => Promise<void>;
};

type CreateDevicePayload = {
  name: string;
  serial_number: string;
  greenhouse_id: number;
  metadata: Record<string, unknown>;
};

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="manifest-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="manifest-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="manifest-modal__header">
          <h2 id={titleId}>{title}</h2>
          <button
            aria-label="Закрыть окно"
            className="manifest-modal__close"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="manifest-loading" role="status" aria-live="polite">
      <span className="manifest-spinner" aria-hidden="true" />
      <div>
        <strong>Загружаем ваши теплицы</strong>
        <p>Получаем список устройств и последние показания. Это может занять несколько секунд.</p>
      </div>
    </div>
  );
}

function AddDeviceForm({
  greenhouses,
  fixedGreenhouseId,
  onCreate,
  onSuccess,
}: {
  greenhouses: Greenhouse[];
  fixedGreenhouseId?: number;
  onCreate: (payload: CreateDevicePayload) => Promise<Device>;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceType, setDeviceType] = useState('sensor');
  const [greenhouseId, setGreenhouseId] = useState(
    fixedGreenhouseId ? String(fixedGreenhouseId) : String(greenhouses[0]?.id || '')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (fixedGreenhouseId) setGreenhouseId(String(fixedGreenhouseId));
  }, [fixedGreenhouseId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!greenhouseId) {
      setError('Сначала выберите теплицу.');
      return;
    }

    setIsSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        serial_number: serialNumber.trim(),
        greenhouse_id: Number(greenhouseId),
        metadata: {
          device_type: deviceType,
          ...(deviceType === 'soil_sensor' ? { sensor_type: 'soil' } : {}),
          ...(deviceType === 'valve' ? { actuator_type: 'irrigation_valve' } : {}),
          ...(deviceType === 'actuator' ? { actuator_type: 'linear_actuator' } : {}),
        },
      });
      onSuccess();
    } catch (submitError) {
      setError(getRequestErrorMessage(submitError, 'Не удалось добавить устройство.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="manifest-modal__body">
      <p className="manifest-modal__intro">
        Укажите понятное название и номер с наклейки или QR-кода. Устройство сразу появится в
        выбранной теплице.
      </p>
      <form className="manifest-add-device__form" onSubmit={handleSubmit}>
        <label>
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Датчик у входа"
            required
          />
        </label>
        <label>
          Номер устройства
          <input
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
            placeholder="С наклейки или QR-кода"
            required
          />
        </label>
        <label>
          Что это за устройство
          <select value={deviceType} onChange={(event) => setDeviceType(event.target.value)}>
            <option value="sensor">Датчик температуры и влажности</option>
            <option value="soil_sensor">Датчик влажности почвы</option>
            <option value="actuator">Привод форточки</option>
            <option value="valve">Клапан полива</option>
          </select>
        </label>
        <label>
          Теплица
          <select
            value={greenhouseId}
            onChange={(event) => setGreenhouseId(event.target.value)}
            disabled={fixedGreenhouseId !== undefined}
            required
          >
            <option value="">Выберите теплицу</option>
            {greenhouses.map((greenhouse) => (
              <option key={greenhouse.id} value={greenhouse.id}>
                {greenhouse.name}
              </option>
            ))}
          </select>
        </label>
        <div className="manifest-add-device__action">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Добавляем...' : 'Добавить устройство'}
          </button>
        </div>
      </form>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function AddGreenhouseForm({
  onCreate,
  onSuccess,
}: {
  onCreate: (payload: { name: string; location?: string }) => Promise<Greenhouse>;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await onCreate({ name: name.trim(), location: location.trim() || undefined });
      onSuccess();
    } catch (submitError) {
      setError(getRequestErrorMessage(submitError, 'Не удалось добавить теплицу.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="manifest-modal__body">
      <p className="manifest-modal__intro">
        Укажите название и расположение. После создания к теплице можно будет подключить устройства.
      </p>
      <form className="compact-form" onSubmit={handleSubmit}>
        <label>
          Название
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Теплица у дома"
            required
          />
        </label>
        <label>
          Расположение
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Например, Южная сторона участка"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="manifest-modal__actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Добавляем...' : 'Добавить теплицу'}
          </button>
        </div>
      </form>
    </div>
  );
}

function relativeTime(dateValue?: string | number | null) {
  if (!dateValue) return 'данных пока нет';
  const timestamp = typeof dateValue === 'number' ? dateValue : new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return 'время неизвестно';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} ч. назад`;
  return new Date(timestamp).toLocaleString('ru-RU');
}

function telemetryDate(timestamp?: number) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('ru-RU');
}

function DeviceParameters({
  device,
  parameters,
  onSave,
}: {
  device: Device;
  parameters: ManifestParameter[];
  onSave: DevicePanelProps['onSave'];
}) {
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        parameters.map((parameter) => [parameter.key, getStoredParameter(device, parameter)])
      ),
    [device, parameters]
  );
  const [values, setValues] = useState<Record<string, number>>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setValues(initialValues), [initialValues]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback('');
    setError('');
    try {
      await onSave(device, values);
      setFeedback('Параметры сохранены в настройках устройства.');
    } catch (saveError) {
      setError(getRequestErrorMessage(saveError, 'Не удалось сохранить параметры.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!parameters.length) return null;

  return (
    <form className="manifest-parameters" onSubmit={handleSubmit}>
      <div className="section-heading section-heading--tight">
        <h4>Параметры управления</h4>
        <p>Настройте допустимые значения и особенности работы этого устройства.</p>
      </div>
      <div className="manifest-parameter-grid">
        {parameters.map((parameter) => (
          <label key={parameter.key}>
            <span>{parameter.label}</span>
            <span className="manifest-input-wrap">
              <input
                aria-label={parameter.label}
                type="number"
                min={parameter.min}
                max={parameter.max}
                step="any"
                value={values[parameter.key] ?? parameter.defaultValue}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [parameter.key]: Number(event.target.value),
                  }))
                }
              />
              <span>{parameter.unit}</span>
            </span>
            <small>{parameter.hint}</small>
          </label>
        ))}
      </div>
      <button type="submit" disabled={isSaving}>
        {isSaving ? 'Сохраняем...' : 'Сохранить параметры'}
      </button>
      {feedback && <p className="form-success">{feedback}</p>}
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

function DevicePanel({
  device,
  telemetry,
  telemetryError,
  onSave,
  onCommand,
}: DevicePanelProps) {
  const presentation = getDevicePresentation(device);
  const latestTelemetryTimestamp = getLatestTelemetryTimestamp(telemetry);
  const historicalStates = getHistoricalStates(telemetry, presentation.states);
  const visibleStates = [...presentation.states, ...historicalStates];
  const [pendingCommand, setPendingCommand] = useState('');
  const [commandStatus, setCommandStatus] = useState('');
  const [commandError, setCommandError] = useState('');

  const handleCommand = async (command: 'open' | 'close' | 'stop') => {
    setPendingCommand(command);
    setCommandStatus('');
    setCommandError('');
    try {
      await onCommand(device, command);
      const labels = { open: 'Открыть', close: 'Закрыть', stop: 'Остановить' };
      setCommandStatus(`Команда «${labels[command]}» отправлена устройству.`);
    } catch (error) {
      setCommandError(getRequestErrorMessage(error, 'Не удалось отправить команду.'));
    } finally {
      setPendingCommand('');
    }
  };

  return (
    <article className="manifest-device">
      <header className="manifest-device__header">
        <div>
          <p className="eyebrow">{presentation.title}</p>
          <h3>{device.name}</h3>
          <p>
            ID {device.serial_number} · последние данные {relativeTime(latestTelemetryTimestamp)}
          </p>
          {latestTelemetryTimestamp && (
            <p className="manifest-data-date">
              Последнее сохранённое показание: {telemetryDate(latestTelemetryTimestamp)}
            </p>
          )}
        </div>
        <span className={device.is_active ? 'status-pill' : 'status-pill status-pill--muted'}>
          {device.is_active ? 'Активно' : 'Отключено'}
        </span>
      </header>

      <div className="manifest-state-grid">
        {visibleStates.map((state) => {
          const value = getLatestTelemetryValue(telemetry, state.telemetryKeys);
          return (
            <div className="manifest-state-card" key={state.key}>
              <span>{state.label}</span>
              <strong>{formatTelemetryValue(value, state)}</strong>
              <small>{state.hint}</small>
            </div>
          );
        })}
      </div>

      {telemetryError && (
        <p className="manifest-inline-warning">
          Свежие показания сейчас недоступны. Управление и сохранение настроек продолжают работать.
        </p>
      )}

      {presentation.supportsCommands && (
        <section className="manifest-command-box">
          <div className="section-heading section-heading--tight">
            <h4>Ручное управление</h4>
            <p>Откройте, закройте или остановите устройство вручную.</p>
          </div>
          <div className="manifest-command-buttons">
            <button
              type="button"
              disabled={Boolean(pendingCommand) || !device.is_active}
              onClick={() => handleCommand('open')}
            >
              {pendingCommand === 'open' ? 'Отправляем...' : 'Открыть'}
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={Boolean(pendingCommand) || !device.is_active}
              onClick={() => handleCommand('close')}
            >
              {pendingCommand === 'close' ? 'Отправляем...' : 'Закрыть'}
            </button>
            <button
              className="manifest-stop-button"
              type="button"
              disabled={Boolean(pendingCommand) || !device.is_active}
              onClick={() => handleCommand('stop')}
            >
              {pendingCommand === 'stop' ? 'Отправляем...' : 'Стоп'}
            </button>
          </div>
          {commandStatus && <p className="form-success">{commandStatus}</p>}
          {commandError && <p className="form-error">{commandError}</p>}
        </section>
      )}

      <DeviceParameters device={device} parameters={presentation.parameters} onSave={onSave} />
    </article>
  );
}

function GreenhouseOverview({
  greenhouse,
  devices,
  telemetry,
}: {
  greenhouse: Greenhouse;
  devices: Device[];
  telemetry: Record<number, DeviceTelemetry>;
}) {
  const greenhouseDevices = devices.filter((device) => device.greenhouse_id === greenhouse.id);
  const climateDevice = greenhouseDevices.find((device) =>
    temperatureStates.some(
      (state) => getLatestTelemetryValue(telemetry[device.id], state.telemetryKeys) !== undefined
    )
  );
  const primaryStates = climateDevice ? temperatureStates : [];

  return (
    <a className="manifest-greenhouse-card" href={`#/greenhouses-new/${greenhouse.id}`}>
      <div className="manifest-greenhouse-card__header">
        <div>
          <p className="eyebrow">{greenhouse.location || 'Локация не указана'}</p>
          <h2>{greenhouse.name}</h2>
        </div>
        <span className={greenhouse.is_active ? 'status-pill' : 'status-pill status-pill--muted'}>
          {greenhouse.is_active ? 'Онлайн' : 'Неактивна'}
        </span>
      </div>
      <div className="manifest-greenhouse-card__metrics">
        {primaryStates.length ? (
          primaryStates.map((state) => (
            <div key={state.key}>
              <span>{state.label}</span>
              <strong>
                {formatTelemetryValue(
                  climateDevice
                    ? getLatestTelemetryValue(
                        telemetry[climateDevice.id],
                        state.telemetryKeys
                      )
                    : undefined,
                  state
                )}
              </strong>
            </div>
          ))
        ) : (
          <div>
            <span>Показания</span>
            <strong>Нет датчика</strong>
          </div>
        )}
        <div>
          <span>Устройств</span>
          <strong>{greenhouseDevices.length}</strong>
        </div>
      </div>
      <span className="manifest-card-link">Открыть управление →</span>
    </a>
  );
}

function ManifestGreenhousesPage({ token, routeState, onAuthExpired }: Props) {
  const {
    devices,
    createDevice,
    createGreenhouse,
    greenhouses,
    isLoading,
    isRefreshing,
    loadError,
    refreshTelemetry,
    saveDeviceParameters,
    sendCommand,
    telemetry,
    telemetryErrors,
  } = useManifestGreenhouses({ token, onAuthExpired });
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isGreenhouseModalOpen, setIsGreenhouseModalOpen] = useState(false);

  if (isLoading) {
    return <LoadingState />;
  }

  if (loadError) {
    return <p className="form-error">{loadError}</p>;
  }

  if (routeState.route === 'greenhouse-new') {
    const greenhouse = greenhouses.find((item) => item.id === routeState.greenhouseId);
    if (!greenhouse) {
      return (
        <section className="empty-block">
          <p>Теплица не найдена.</p>
          <a href="#/greenhouses-new">Вернуться к списку</a>
        </section>
      );
    }

    const greenhouseDevices = devices.filter((device) => device.greenhouse_id === greenhouse.id);
    const onlineDevices = greenhouseDevices.filter((device) => device.is_active).length;

    return (
      <div className="manifest-page">
        <section className="page-intro page-intro--detail">
          <div>
            <a className="back-link" href="#/greenhouses-new">
              ← К новым теплицам
            </a>
            <p className="eyebrow">Управление теплицей</p>
            <h1>{greenhouse.name}</h1>
            <p className="page-intro__text">
              Следите за показаниями, меняйте настройки и управляйте оборудованием в одном месте.
              Данные обновляются автоматически.
            </p>
          </div>
          <dl className="summary-strip">
            <div>
              <dt>Устройств</dt>
              <dd>{greenhouseDevices.length}</dd>
            </div>
            <div>
              <dt>Активных</dt>
              <dd>{onlineDevices}</dd>
            </div>
            <div>
              <dt>Управление</dt>
              <dd>Авто</dd>
            </div>
            <div>
              <dt>Обновление</dt>
              <dd>30 сек.</dd>
            </div>
          </dl>
        </section>

        <div className="manifest-toolbar">
          <div>
            <strong>Состояние системы</strong>
            <span>Последние показания датчиков и состояние оборудования</span>
          </div>
          <div className="manifest-toolbar__actions">
            <button
              className="secondary-action"
              type="button"
              onClick={() => setIsDeviceModalOpen(true)}
            >
              Добавить устройство
            </button>
            <button type="button" disabled={isRefreshing} onClick={refreshTelemetry}>
              {isRefreshing ? 'Обновляем...' : 'Обновить данные'}
            </button>
          </div>
        </div>

        {greenhouseDevices.length ? (
          <div className="manifest-device-list">
            {greenhouseDevices.map((device) => (
              <DevicePanel
                key={device.id}
                device={device}
                telemetry={telemetry[device.id]}
                telemetryError={telemetryErrors[device.id]}
                onSave={saveDeviceParameters}
                onCommand={sendCommand}
              />
            ))}
          </div>
        ) : (
          <section className="empty-block">
            <p>В этой теплице пока нет устройств.</p>
            <button type="button" onClick={() => setIsDeviceModalOpen(true)}>
              Добавить первое устройство
            </button>
          </section>
        )}

        {isDeviceModalOpen && (
          <Modal title="Добавить устройство" onClose={() => setIsDeviceModalOpen(false)}>
            <AddDeviceForm
              greenhouses={greenhouses}
              fixedGreenhouseId={greenhouse.id}
              onCreate={createDevice}
              onSuccess={() => setIsDeviceModalOpen(false)}
            />
          </Modal>
        )}
      </div>
    );
  }

  const activeGreenhouses = greenhouses.filter((greenhouse) => greenhouse.is_active).length;
  const activeDevices = devices.filter((device) => device.is_active).length;

  return (
    <div className="manifest-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Все теплицы</p>
          <h1>Теплицы новое</h1>
          <p className="page-intro__text">
            Следите за микроклиматом, проверяйте состояние оборудования и переходите к управлению
            каждой теплицей.
          </p>
        </div>
        <dl className="summary-strip">
          <div>
            <dt>Всего теплиц</dt>
            <dd>{greenhouses.length}</dd>
          </div>
          <div>
            <dt>Активных</dt>
            <dd>{activeGreenhouses}</dd>
          </div>
          <div>
            <dt>Устройств</dt>
            <dd>{devices.length}</dd>
          </div>
          <div>
            <dt>На связи</dt>
            <dd>{activeDevices}</dd>
          </div>
        </dl>
      </section>

      <div className="manifest-toolbar">
        <div>
          <strong>Живые данные</strong>
          <span>Показания обновляются автоматически каждые 30 секунд</span>
        </div>
        <div className="manifest-toolbar__actions">
          <button
            className="secondary-action"
            type="button"
            onClick={() => setIsGreenhouseModalOpen(true)}
          >
            Добавить теплицу
          </button>
          {greenhouses.length > 0 && (
            <button
              className="secondary-action"
              type="button"
              onClick={() => setIsDeviceModalOpen(true)}
            >
              Добавить устройство
            </button>
          )}
          <button type="button" disabled={isRefreshing} onClick={refreshTelemetry}>
            {isRefreshing ? 'Обновляем...' : 'Обновить показания'}
          </button>
        </div>
      </div>

      {greenhouses.length ? (
        <div className="manifest-greenhouse-grid">
          {greenhouses.map((greenhouse) => (
            <GreenhouseOverview
              key={greenhouse.id}
              greenhouse={greenhouse}
              devices={devices}
              telemetry={telemetry}
            />
          ))}
        </div>
      ) : (
        <section className="empty-block">
          <p>Теплиц пока нет. Добавьте первую, чтобы начать работу.</p>
          <button type="button" onClick={() => setIsGreenhouseModalOpen(true)}>
            Добавить первую теплицу
          </button>
        </section>
      )}

      {isGreenhouseModalOpen && (
        <Modal title="Добавить теплицу" onClose={() => setIsGreenhouseModalOpen(false)}>
          <AddGreenhouseForm
            onCreate={createGreenhouse}
            onSuccess={() => setIsGreenhouseModalOpen(false)}
          />
        </Modal>
      )}

      {isDeviceModalOpen && (
        <Modal title="Добавить устройство" onClose={() => setIsDeviceModalOpen(false)}>
          <AddDeviceForm
            greenhouses={greenhouses}
            onCreate={createDevice}
            onSuccess={() => setIsDeviceModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}

export default ManifestGreenhousesPage;
