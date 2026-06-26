import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Device, DeviceTelemetry, Greenhouse, RouteState, TelemetrySample } from '../../types';
import { requestJson } from '../../utils/api';
import { getRequestErrorMessage } from '../../utils/errors';

type Props = {
  token: string;
  routeState: RouteState;
  onAuthExpired: () => void;
};

type ModalName = 'greenhouse-create' | 'greenhouse-edit' | 'device-create' | 'device-add-menu' | null;
type DeviceKind = 'sensor' | 'soil_sensor' | 'actuator' | 'valve' | 'other';
type DeviceKindFilter = DeviceKind | 'all';

type FieldErrors = {
  name?: string;
  serialNumber?: string;
};

const deviceKindLabels: Record<DeviceKind, string> = {
  sensor: 'Датчик температуры и влажности',
  soil_sensor: 'Датчик влажности почвы',
  actuator: 'Привод форточки',
  valve: 'Клапан полива',
  other: 'Другое устройство',
};

const deviceKindFilterLabels: Record<DeviceKindFilter, string> = {
  all: 'Все',
  ...deviceKindLabels,
};

function getFriendlyError(error: unknown, fallback: string) {
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

function formatDateTime(value?: string | number | null) {
  if (!value) return 'нет данных';
  const normalizedValue =
    typeof value === 'string' && value.includes('T') && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)
      ? `${value}Z`
      : value;
  const timestamp =
    typeof normalizedValue === 'number' ? normalizedValue : new Date(normalizedValue).getTime();
  if (!Number.isFinite(timestamp)) return 'нет данных';
  return new Date(timestamp).toLocaleString('ru-RU');
}

function formatTelemetryValue(value: unknown) {
  if (value === undefined || value === null || value === '') return 'Нет данных';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getLatestSample(samples: TelemetrySample[]) {
  return samples.reduce(
    (latest, sample) => (!latest || sample.ts > latest.ts ? sample : latest),
    undefined as TelemetrySample | undefined
  );
}

function getTelemetryRows(telemetry?: DeviceTelemetry) {
  if (!telemetry) return [];

  return Object.entries(telemetry.telemetry)
    .map(([key, samples]) => {
      const latest = getLatestSample(samples || []);
      return latest ? { key, sample: latest } : null;
    })
    .filter((item): item is { key: string; sample: TelemetrySample } => Boolean(item))
    .sort((left, right) => right.sample.ts - left.sample.ts);
}

function getDeviceKind(device: Device): DeviceKind {
  const metadata = device.metadata || device.device_metadata || {};
  const type = metadata.device_type;
  if (type === 'sensor' || type === 'soil_sensor' || type === 'actuator' || type === 'valve') {
    return type;
  }
  return 'other';
}

function buildDeviceMetadata(kind: DeviceKind) {
  return {
    device_type: kind,
    ...(kind === 'soil_sensor' ? { sensor_type: 'soil' } : {}),
    ...(kind === 'actuator' ? { actuator_type: 'linear_actuator' } : {}),
    ...(kind === 'valve' ? { actuator_type: 'irrigation_valve' } : {}),
  };
}

function Modal({
  title,
  children,
  onClose,
  size = 'regular',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'compact' | 'regular' | 'wide';
}) {
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
    <div className="my-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className={`my-modal my-modal--${size}`}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="my-modal__header">
          <h2>{title}</h2>
          <button aria-label="Закрыть" type="button" onClick={onClose}>
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
    <div className="my-loading" role="status" aria-live="polite">
      <span className="manifest-spinner" aria-hidden="true" />
      <div>
        <strong>Загружаем ваши теплицы</strong>
        <p>Получаем теплицы, устройства и последние данные телеметрии.</p>
      </div>
    </div>
  );
}

function GreenhouseForm({
  greenhouse,
  onSubmit,
}: {
  greenhouse?: Greenhouse;
  onSubmit: (payload: { name: string; location?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(greenhouse?.name || '');
  const [location, setLocation] = useState(greenhouse?.location || '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = 'Заполните поле для сохранения.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setIsSaving(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), location: location.trim() || undefined });
    } catch (submitError) {
      setError(getFriendlyError(submitError, 'Попробуйте позже: теплицу не удалось сохранить.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="my-form" noValidate onSubmit={handleSubmit}>
      <label>
        <span>Название теплицы *</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Например, Южная теплица"
        />
        {fieldErrors.name && <small>{fieldErrors.name}</small>}
      </label>
      <label>
        <span>Расположение</span>
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Например, участок у дома"
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <footer className="my-form__actions">
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </footer>
    </form>
  );
}

function DeviceCreateForm({
  greenhouses,
  fixedGreenhouseId,
  onSubmit,
}: {
  greenhouses: Greenhouse[];
  fixedGreenhouseId?: number;
  onSubmit: (payload: {
    name: string;
    serial_number: string;
    greenhouse_id?: number | null;
    metadata: Record<string, unknown>;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [kind, setKind] = useState<DeviceKind>('sensor');
  const [greenhouseId, setGreenhouseId] = useState(
    fixedGreenhouseId ? String(fixedGreenhouseId) : ''
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = 'Заполните поле для сохранения.';
    if (!serialNumber.trim()) nextErrors.serialNumber = 'Заполните поле для сохранения.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setIsSaving(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        serial_number: serialNumber.trim(),
        greenhouse_id: greenhouseId ? Number(greenhouseId) : null,
        metadata: buildDeviceMetadata(kind),
      });
    } catch (submitError) {
      setError(getFriendlyError(submitError, 'Попробуйте позже: устройство не удалось добавить.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="my-form my-device-form" noValidate onSubmit={handleSubmit}>
      <aside className="my-form__hint">
        Введите номер с наклейки, паспорта или QR-кода. Система проверит, зарегистрировано ли
        устройство и можно ли привязать его к вашему аккаунту.
      </aside>
      <label className="my-form__field">
        <span>Название устройства *</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Например, Термометр у входа"
        />
        {fieldErrors.name && <small>{fieldErrors.name}</small>}
      </label>
      <label className="my-form__field">
        <span>Номер устройства *</span>
        <input
          value={serialNumber}
          onChange={(event) => setSerialNumber(event.target.value)}
          placeholder="Device ID из ThingsBoard или номер устройства"
        />
        {fieldErrors.serialNumber && <small>{fieldErrors.serialNumber}</small>}
      </label>
      <fieldset className="my-type-options">
        <legend>Назначение устройства</legend>
        {Object.entries(deviceKindLabels).map(([value, label]) => (
          <button
            key={value}
            className={kind === value ? 'active' : ''}
            type="button"
            onClick={() => setKind(value as DeviceKind)}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <label className="my-form__field">
        <span>Теплица</span>
        <select
          value={greenhouseId}
          onChange={(event) => setGreenhouseId(event.target.value)}
          disabled={fixedGreenhouseId !== undefined}
        >
          <option value="">Не привязывать пока</option>
          {greenhouses.map((greenhouse) => (
            <option key={greenhouse.id} value={greenhouse.id}>
              {greenhouse.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="form-error">{error}</p>}
      <footer className="my-form__actions">
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Добавляем...' : 'Добавить устройство'}
        </button>
      </footer>
    </form>
  );
}

function AssignDeviceForm({
  devices,
  greenhouseId,
  onAssign,
}: {
  devices: Device[];
  greenhouseId: number;
  onAssign: (deviceId: number, greenhouseId: number) => Promise<void>;
}) {
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deviceId) {
      setError('Выберите устройство для привязки.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onAssign(Number(deviceId), greenhouseId);
    } catch (submitError) {
      setError(getFriendlyError(submitError, 'Попробуйте позже: устройство не удалось привязать.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="my-form" onSubmit={handleSubmit}>
      <label>
        <span>Нераспределенное устройство</span>
        <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
          <option value="">Выберите устройство</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name} · {device.serial_number}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="form-error">{error}</p>}
      <footer className="my-form__actions">
        <button type="submit" disabled={isSaving || !devices.length}>
          {isSaving ? 'Привязываем...' : 'Привязать'}
        </button>
      </footer>
    </form>
  );
}

function UnassignedDeviceCard({
  device,
  greenhouses,
  onAssign,
}: {
  device: Device;
  greenhouses: Greenhouse[];
  onAssign: (deviceId: number, greenhouseId: number) => Promise<void>;
}) {
  const [greenhouseId, setGreenhouseId] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAssign = async () => {
    if (!greenhouseId) return;
    setIsSaving(true);
    setError('');
    try {
      await onAssign(device.id, Number(greenhouseId));
    } catch (assignError) {
      setError(getFriendlyError(assignError, 'Попробуйте позже: устройство не удалось привязать.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="my-unassigned-card">
      <div>
        <strong>{device.name}</strong>
        <span>{device.serial_number}</span>
      </div>
      <label>
        <span>Привязать к теплице</span>
        <select value={greenhouseId} onChange={(event) => setGreenhouseId(event.target.value)}>
          <option value="">Выберите теплицу</option>
          {greenhouses.map((greenhouse) => (
            <option key={greenhouse.id} value={greenhouse.id}>
              {greenhouse.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={!greenhouseId || isSaving} onClick={handleAssign}>
        {isSaving ? 'Привязываем...' : 'Привязать'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </article>
  );
}

function GreenhouseCard({ greenhouse }: { greenhouse: Greenhouse }) {
  return (
    <a className="my-greenhouse-card" href={`#/my-greenhouses/${greenhouse.id}`}>
      <div>
        <h2>{greenhouse.name}</h2>
        <p>{greenhouse.location || 'Расположение не указано'}</p>
      </div>
      <span className="my-greenhouse-card__action">Открыть управление</span>
    </a>
  );
}

function DeviceTelemetryPanel({
  device,
  telemetry,
  telemetryError,
  onCommand,
}: {
  device: Device;
  telemetry?: DeviceTelemetry;
  telemetryError?: string;
  onCommand: (device: Device, command: 'open' | 'close' | 'stop') => Promise<void>;
}) {
  const rows = getTelemetryRows(telemetry);
  const kind = getDeviceKind(device);
  const canControl = kind === 'actuator' || kind === 'valve';
  const [pendingCommand, setPendingCommand] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const handleCommand = async (command: 'open' | 'close' | 'stop') => {
    setPendingCommand(command);
    setFeedback('');
    setError('');
    try {
      await onCommand(device, command);
      setFeedback('Команда отправлена устройству.');
    } catch (commandError) {
      setError(getFriendlyError(commandError, 'Попробуйте позже: команду не удалось отправить.'));
    } finally {
      setPendingCommand('');
    }
  };

  return (
    <article className="my-device-card">
      <header>
        <div>
          <span>{deviceKindLabels[kind]}</span>
          <h3>{device.name}</h3>
          <p>{device.serial_number}</p>
        </div>
        <time>{telemetry ? `Получено: ${formatDateTime(telemetry.retrieved_at)}` : 'нет данных'}</time>
      </header>

      {telemetryError ? (
        <p className="my-inline-warning">{telemetryError}</p>
      ) : rows.length ? (
        <dl className="my-telemetry-grid">
          {rows.map(({ key, sample }) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{formatTelemetryValue(sample.value)}</dd>
              <small>{formatDateTime(sample.ts)}</small>
            </div>
          ))}
        </dl>
      ) : (
        <p className="my-inline-warning">Показаний пока нет. Попробуйте обновить данные позже.</p>
      )}

      {canControl && (
        <div className="my-command-row">
          <button
            type="button"
            disabled={Boolean(pendingCommand)}
            onClick={() => handleCommand('open')}
          >
            {pendingCommand === 'open' ? 'Отправляем...' : 'Открыть'}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={Boolean(pendingCommand)}
            onClick={() => handleCommand('close')}
          >
            {pendingCommand === 'close' ? 'Отправляем...' : 'Закрыть'}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={Boolean(pendingCommand)}
            onClick={() => handleCommand('stop')}
          >
            {pendingCommand === 'stop' ? 'Отправляем...' : 'Стоп'}
          </button>
        </div>
      )}
      {feedback && <p className="form-success">{feedback}</p>}
      {error && <p className="form-error">{error}</p>}
    </article>
  );
}

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

  const selectedGreenhouse = greenhouses.find((item) => item.id === routeState.greenhouseId);
  const greenhouseDevices = selectedGreenhouse
    ? devices.filter((device) => device.greenhouse_id === selectedGreenhouse.id)
    : [];
  const filteredGreenhouseDevices =
    deviceKindFilter === 'all'
      ? greenhouseDevices
      : greenhouseDevices.filter((device) => getDeviceKind(device) === deviceKindFilter);
  const unassignedDevices = devices.filter((device) => device.greenhouse_id == null);

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
      setTelemetry((current) => ({ ...current, ...nextTelemetry }));
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

  const sendCommand = async (device: Device, command: 'open' | 'close' | 'stop') => {
    await requestJson<{ message: string }>(`/api/rpc/${device.id}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'setActuatorState',
        params: { state: command },
      }),
      fallbackError: 'Попробуйте позже: команду не удалось отправить.',
      onAuthExpired,
    });
    window.setTimeout(() => loadTelemetry([device], true), 1200);
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
              <label>
                <span>Показать устройства</span>
                <select
                  value={deviceKindFilter}
                  onChange={(event) => setDeviceKindFilter(event.target.value as DeviceKindFilter)}
                >
                  {Object.entries(deviceKindFilterLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="my-device-list">
              {filteredGreenhouseDevices.length ? (
                filteredGreenhouseDevices.map((device) => (
                  <DeviceTelemetryPanel
                    key={device.id}
                    device={device}
                    telemetry={telemetry[device.id]}
                    telemetryError={telemetryErrors[device.id]}
                    onCommand={sendCommand}
                  />
                ))
              ) : (
                <p className="my-inline-warning">Устройств выбранного типа в этой теплице нет.</p>
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

        {modal === 'greenhouse-edit' && (
          <Modal title="Редактировать теплицу" size="compact" onClose={closeModal}>
            <GreenhouseForm greenhouse={selectedGreenhouse} onSubmit={updateGreenhouse} />
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
          <DeviceCreateForm greenhouses={greenhouses} onSubmit={createDevice} />
        </Modal>
      )}
    </section>
  );
}

export default MyGreenhousesPage;
