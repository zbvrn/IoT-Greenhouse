import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Device, DeviceTelemetry, Greenhouse, RouteState, TelemetrySample } from '../../types';
import { requestJson, requestVoid } from '../../utils/api';
import { getRequestErrorMessage } from '../../utils/errors';

type Props = {
  token: string;
  routeState: RouteState;
  onAuthExpired: () => void;
};

type ModalName =
  | 'greenhouse-create'
  | 'greenhouse-edit'
  | 'greenhouse-delete'
  | 'device-create'
  | 'device-add-menu'
  | null;
type DeviceKind = 'sensor' | 'soil_sensor' | 'actuator' | 'valve' | 'other';
type DeviceKindFilter = DeviceKind | 'all';
type DeviceCommand = 'open' | 'close' | 'stop';

type DeviceUpdatePayload = {
  name: string;
  kind: DeviceKind;
  greenhouseId?: number;
};

type FieldErrors = {
  name?: string;
  serialNumber?: string;
};

type SelectOption = {
  value: string;
  label: string;
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

const telemetryLabels: Record<string, string> = {
  temperature: 'Температура',
  humidity: 'Влажность воздуха',
  soilHumidity: 'Влажность почвы',
  soilMoisture: 'Влажность почвы',
  moisture: 'Влажность почвы',
  position: 'Положение',
  windowPosition: 'Положение форточки',
  actuatorOpen: 'Состояние привода',
  status: 'Состояние',
  speed: 'Скорость',
};

const normalizedTelemetryLabels: Record<string, string> = {
  temperature: 'Температура',
  humidity: 'Влажность воздуха',
  soilhumidity: 'Влажность почвы',
  soilmoisture: 'Влажность почвы',
  moisture: 'Влажность почвы',
  position: 'Положение',
  windowposition: 'Положение форточки',
  actuatoropen: 'Состояние привода',
  actuatoropenstate: 'Состояние привода',
  status: 'Состояние',
  state: 'Состояние',
  speed: 'Скорость',
};

const telemetryDisplayOrder = [
  'temperature',
  'humidity',
  'soilhumidity',
  'soilmoisture',
  'moisture',
  'windowposition',
  'position',
  'actuatoropen',
  'actuatoropenstate',
  'status',
  'state',
  'speed',
];

function Dropdown({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  placement = 'down',
  inlineMenu = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  placement?: 'up' | 'down';
  inlineMenu?: boolean;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const open = () => {
    if (disabled) return;
    setActiveIndex(Math.max(selectedIndex, 0));
    setIsOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setActiveIndex(index);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) =>
        Math.min(Math.max(current + direction, 0), Math.max(options.length - 1, 0))
      );
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) choose(activeIndex);
      else open();
    }
  };

  return (
    <div
      className={`my-select my-select--${placement}${inlineMenu ? ' my-select--inline-menu' : ''}${isOpen ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={!selectedOption ? 'is-placeholder' : ''}
        disabled={disabled}
        role="combobox"
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <span className="my-select__chevron" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="my-select__menu" id={listboxId} role="listbox">
          {options.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={index === activeIndex ? 'is-active' : ''}
              key={option.value}
              role="option"
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

function getTelemetryLabel(key: string) {
  return telemetryLabels[key] || normalizedTelemetryLabels[normalizeTelemetryKey(key)] || key;
}

function normalizeTelemetryKey(key: string) {
  return key.replace(/[_\-\s]/g, '').toLowerCase();
}

function getTelemetryUnit(key: string) {
  const normalizedKey = normalizeTelemetryKey(key);
  if (normalizedKey === 'temperature') return '°C';
  if (/humidity|moisture|position/i.test(normalizedKey)) return '%';
  if (normalizedKey === 'speed') return '%';
  return '';
}

function formatVisualValue(key: string, value: unknown) {
  const normalizedKey = normalizeTelemetryKey(key);
  if (/status|state|actuatoropen/.test(normalizedKey)) {
    const normalized = String(value).trim().toLowerCase();
    const stateLabels: Record<string, string> = {
      true: 'Открыто',
      false: 'Закрыто',
      open: 'Открыто',
      opened: 'Открыто',
      opening: 'Открывается',
      close: 'Закрыто',
      closed: 'Закрыто',
      closing: 'Закрывается',
      stop: 'Остановлено',
      stopped: 'Остановлено',
    };
    if (stateLabels[normalized]) return stateLabels[normalized];
  }
  const formatted = formatTelemetryValue(value);
  const unit = getTelemetryUnit(key);
  return unit && formatted !== 'Нет данных' ? `${formatted} ${unit}` : formatted;
}

function hasTelemetryValue(sample: TelemetrySample) {
  return sample.value !== undefined && sample.value !== null && sample.value !== '';
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
    .sort((left, right) => {
      const valuePriority =
        Number(hasTelemetryValue(right.sample)) - Number(hasTelemetryValue(left.sample));
      if (valuePriority) return valuePriority;

      const leftKey = normalizeTelemetryKey(left.key);
      const rightKey = normalizeTelemetryKey(right.key);
      const leftIndex = telemetryDisplayOrder.indexOf(leftKey);
      const rightIndex = telemetryDisplayOrder.indexOf(rightKey);
      const orderPriority =
        (leftIndex === -1 ? telemetryDisplayOrder.length : leftIndex) -
        (rightIndex === -1 ? telemetryDisplayOrder.length : rightIndex);
      if (orderPriority) return orderPriority;

      return getTelemetryLabel(left.key).localeCompare(getTelemetryLabel(right.key), 'ru');
    });
}

function getNumericTelemetrySummary(samples: TelemetrySample[]) {
  const numericSamples = samples
    .filter(
      (sample) =>
        typeof sample.value === 'number' ||
        (typeof sample.value === 'string' && sample.value.trim() !== '')
    )
    .map((sample) => ({ ...sample, numericValue: Number(sample.value) }))
    .filter((sample) => Number.isFinite(sample.numericValue))
    .sort((left, right) => left.ts - right.ts);

  if (!numericSamples.length) return null;

  const values = numericSamples.map((sample) => sample.numericValue);
  const latest = numericSamples[numericSamples.length - 1];
  const previous = numericSamples[numericSamples.length - 2];
  const trend = previous
    ? latest.numericValue > previous.numericValue
      ? 'up'
      : latest.numericValue < previous.numericValue
        ? 'down'
        : 'steady'
    : 'steady';

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    trend,
    samples: numericSamples,
  };
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
      <span className="my-spinner" aria-hidden="true" />
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
          aria-invalid={Boolean(fieldErrors.name)}
        />
      </label>
      <label>
        <span>Расположение</span>
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Например, участок у дома"
        />
      </label>
      <div className="my-form__status" aria-live="polite">
        {(fieldErrors.name || error) && <p className="form-error">{fieldErrors.name || error}</p>}
      </div>
      <footer className="my-form__actions">
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </footer>
    </form>
  );
}

function DeleteGreenhouseConfirm({
  greenhouse,
  onConfirm,
}: {
  greenhouse: Greenhouse;
  onConfirm: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await onConfirm();
    } catch (deleteError) {
      setError(getFriendlyError(deleteError, 'Попробуйте позже: теплицу не удалось удалить.'));
      setIsDeleting(false);
    }
  };

  return (
    <div className="my-confirm-dialog">
      <p>Теплица «{greenhouse.name}» будет удалена без возможности восстановления.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="danger-action" type="button" disabled={isDeleting} onClick={handleDelete}>
        {isDeleting ? 'Удаляем...' : 'Удалить теплицу'}
      </button>
    </div>
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
          aria-invalid={Boolean(fieldErrors.name)}
        />
      </label>
      <label className="my-form__field">
        <span>Номер устройства *</span>
        <input
          value={serialNumber}
          onChange={(event) => setSerialNumber(event.target.value)}
          placeholder="Номер с наклейки или паспорта устройства"
          aria-invalid={Boolean(fieldErrors.serialNumber)}
        />
      </label>
      <fieldset className="my-type-options">
        <legend>Назначение устройства</legend>
        <small className="my-type-options__hint">
          Выберите назначение, указанное в паспорте или на самом устройстве.
        </small>
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
      {fixedGreenhouseId === undefined && (
        <div className="my-form__field">
          <span>Теплица</span>
          <Dropdown
            value={greenhouseId}
            onChange={setGreenhouseId}
            placement="up"
            placeholder="Пока не привязывать"
            options={[
              { value: '', label: 'Пока не привязывать' },
              ...greenhouses.map((greenhouse) => ({
                value: String(greenhouse.id),
                label: greenhouse.name,
              })),
            ]}
          />
        </div>
      )}
      <div className="my-form__status" aria-live="polite">
        {(fieldErrors.name || fieldErrors.serialNumber || error) && (
          <p className="form-error">{fieldErrors.name || fieldErrors.serialNumber || error}</p>
        )}
      </div>
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
      <div className="my-form__field">
        <span>Нераспределенное устройство</span>
        <Dropdown
          value={deviceId}
          onChange={setDeviceId}
          placeholder="Выберите устройство"
          options={devices.map((device) => ({
            value: String(device.id),
            label: `${device.name} · ${device.serial_number}`,
          }))}
        />
      </div>
      <div className="my-form__status" aria-live="polite">
        {error && <p className="form-error">{error}</p>}
      </div>
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
  onUpdate,
  onDelete,
}: {
  device: Device;
  greenhouses: Greenhouse[];
  onAssign: (deviceId: number, greenhouseId: number) => Promise<void>;
  onUpdate: (device: Device, payload: DeviceUpdatePayload) => Promise<void>;
  onDelete: (device: Device) => Promise<void>;
}) {
  const [greenhouseId, setGreenhouseId] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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
      <div className="my-unassigned-card__field">
        <span>Привязать к теплице</span>
        <Dropdown
          value={greenhouseId}
          onChange={setGreenhouseId}
          placeholder="Выберите теплицу"
          options={greenhouses.map((greenhouse) => ({
            value: String(greenhouse.id),
            label: greenhouse.name,
          }))}
        />
      </div>
      <div className="my-unassigned-card__actions">
        <button type="button" disabled={!greenhouseId || isSaving} onClick={handleAssign}>
          {isSaving ? 'Привязываем...' : 'Привязать'}
        </button>
        <button className="secondary-action" type="button" onClick={() => setIsSettingsOpen(true)}>
          Настроить
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {isSettingsOpen && (
        <Modal title="Настроить устройство" size="wide" onClose={() => setIsSettingsOpen(false)}>
          <DeviceSettingsForm
            device={device}
            greenhouses={greenhouses}
            onSave={async (currentDevice, payload) => {
              await onUpdate(currentDevice, payload);
              setIsSettingsOpen(false);
            }}
            onRequestDelete={() => setIsDeleteConfirmOpen(true)}
          />
        </Modal>
      )}
      {isDeleteConfirmOpen && (
        <Modal title="Удалить устройство" size="compact" onClose={() => setIsDeleteConfirmOpen(false)}>
          <DeleteDeviceConfirm
            device={device}
            onCancel={() => setIsDeleteConfirmOpen(false)}
            onConfirm={async () => {
              await onDelete(device);
              setIsDeleteConfirmOpen(false);
              setIsSettingsOpen(false);
            }}
          />
        </Modal>
      )}
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

function formatNumericValue(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function TelemetryHistory({ telemetry }: { telemetry: DeviceTelemetry }) {
  const keys = useMemo(
    () => Object.keys(telemetry.telemetry).filter((key) => telemetry.telemetry[key]?.length),
    [telemetry]
  );
  const [selectedKey, setSelectedKey] = useState(keys[0] || '');

  useEffect(() => {
    if (!keys.includes(selectedKey)) setSelectedKey(keys[0] || '');
  }, [keys, selectedKey]);

  if (!keys.length) {
    return <p className="my-inline-warning">История показаний пока отсутствует.</p>;
  }

  const samples = [...(telemetry.telemetry[selectedKey] || [])].sort(
    (left, right) => left.ts - right.ts
  );
  const hasValues = samples.some(hasTelemetryValue);
  const summary = getNumericTelemetrySummary(samples);
  const unit = getTelemetryUnit(selectedKey);
  const chartWidth = 720;
  const chartHeight = 210;
  const chartPadding = 22;
  const numericValues = summary?.samples || [];
  const valueRange = summary ? summary.max - summary.min || 1 : 1;
  const points = numericValues
    .map((sample, index) => {
      const x =
        numericValues.length === 1
          ? chartWidth / 2
          : chartPadding +
            (index / (numericValues.length - 1)) * (chartWidth - chartPadding * 2);
      const y =
        chartHeight -
        chartPadding -
        ((sample.numericValue - (summary?.min || 0)) / valueRange) *
          (chartHeight - chartPadding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="my-history">
      <div className="my-history__toolbar">
        <div className="my-form__field">
          <span>Показатель</span>
          <Dropdown
            value={selectedKey}
            onChange={setSelectedKey}
            placeholder="Выберите показатель"
            inlineMenu
            options={keys.map((key) => ({ value: key, label: getTelemetryLabel(key) }))}
          />
        </div>
        <span>Доступно значений: {samples.length}</span>
      </div>

      {summary ? (
        <>
          <div className="my-history__summary">
            <div><span>Минимум</span><strong>{formatNumericValue(summary.min)} {unit}</strong></div>
            <div><span>Максимум</span><strong>{formatNumericValue(summary.max)} {unit}</strong></div>
            <div>
              <span>Изменение</span>
              <strong>
                {summary.trend === 'up' ? 'Растет ↑' : summary.trend === 'down' ? 'Снижается ↓' : 'Без изменений'}
              </strong>
            </div>
          </div>
          <div className="my-history__chart" aria-label={`График: ${getTelemetryLabel(selectedKey)}`}>
            <svg role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <title>История показателя «{getTelemetryLabel(selectedKey)}»</title>
              <line x1={chartPadding} y1={chartPadding} x2={chartPadding} y2={chartHeight - chartPadding} />
              <line x1={chartPadding} y1={chartHeight - chartPadding} x2={chartWidth - chartPadding} y2={chartHeight - chartPadding} />
              <polyline points={points} />
            </svg>
          </div>
        </>
      ) : hasValues ? (
        <p className="my-inline-warning">Для текстовых значений доступна таблица без графика.</p>
      ) : (
        <p className="my-inline-warning">Для этого показателя пока нет полученных значений.</p>
      )}

      {hasValues && (
        <div className="my-history__table-wrap">
          <table className="my-history__table">
            <thead><tr><th>Дата и время</th><th>Значение</th></tr></thead>
            <tbody>
              {[...samples].reverse().filter(hasTelemetryValue).map((sample, index) => (
                <tr key={`${sample.ts}-${index}`}>
                  <td>{formatDateTime(sample.ts)}</td>
                  <td>{formatVisualValue(selectedKey, sample.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type TelemetryRow = {
  key: string;
  sample: TelemetrySample;
};

function DeviceScreen({ rows, compact = false }: { rows: TelemetryRow[]; compact?: boolean }) {
  const visibleRows = [...rows].sort(
    (left, right) => Number(hasTelemetryValue(right.sample)) - Number(hasTelemetryValue(left.sample))
  );
  return (
    <div className={`my-device-render__screen${compact ? ' is-compact' : ''}${visibleRows.length > 4 ? ' is-dense' : ''}`}>
      <div className="my-device-render__screen-header">
        <span>LIVE</span>
        <i aria-hidden="true" />
      </div>
      {visibleRows.length ? (
        visibleRows.map(({ key, sample }) => (
          <div className="my-device-render__screen-row" key={key}>
            <span>{getTelemetryLabel(key)}</span>
            <strong>{formatVisualValue(key, sample.value)}</strong>
          </div>
        ))
      ) : (
        <div className="my-device-render__screen-empty">НЕТ ДАННЫХ</div>
      )}
    </div>
  );
}

function DeviceControls({
  pendingCommand,
  onCommand,
}: {
  pendingCommand: string;
  onCommand: (command: DeviceCommand) => void;
}) {
  return (
    <div className="my-device-render__controls" aria-label="Управление устройством">
      <button
        aria-label="Открыть"
        disabled={Boolean(pendingCommand)}
        title="Открыть"
        type="button"
        onClick={() => onCommand('open')}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        aria-label="Стоп"
        disabled={Boolean(pendingCommand)}
        title="Стоп"
        type="button"
        onClick={() => onCommand('stop')}
      >
        <span aria-hidden="true">■</span>
      </button>
      <button
        aria-label="Закрыть"
        disabled={Boolean(pendingCommand)}
        title="Закрыть"
        type="button"
        onClick={() => onCommand('close')}
      >
        <span aria-hidden="true">↓</span>
      </button>
    </div>
  );
}

function DeviceIllustration({
  kind,
  rows,
  pendingCommand,
  onCommand,
}: {
  kind: DeviceKind;
  rows: TelemetryRow[];
  pendingCommand: string;
  onCommand: (command: DeviceCommand) => void;
}) {
  const canControl = kind === 'actuator' || kind === 'valve';
  return (
    <div className={`my-device-render my-device-render--other${canControl ? ' has-controls' : ''}`}>
      <div className="my-device-render__antenna" />
      <div className="my-device-render__rugged-case">
        <div className="my-device-render__identity">
          <span className="my-device-render__model">Умная теплица</span>
          <span className="my-device-render__type">{deviceKindLabels[kind]}</span>
        </div>
        <DeviceScreen rows={rows} />
        {canControl && <DeviceControls pendingCommand={pendingCommand} onCommand={onCommand} />}
        <div className="my-device-render__connectors"><i /><i /><i /></div>
      </div>
    </div>
  );
}

function DeviceVisual({
  device,
  kind,
  rows,
  telemetry,
  pendingCommand,
  feedback,
  error,
  onCommand,
  onDismissError,
}: {
  device: Device;
  kind: DeviceKind;
  rows: TelemetryRow[];
  telemetry?: DeviceTelemetry;
  pendingCommand: string;
  feedback: string;
  error: string;
  onCommand: (command: DeviceCommand) => void;
  onDismissError: () => void;
}) {
  return (
    <div className="my-device-visual-modal">
      <div className="my-device-visual-stage">
        <DeviceIllustration
          kind={kind}
          rows={rows}
          pendingCommand={pendingCommand}
          onCommand={onCommand}
        />
      </div>
      <div className="my-device-visual-details">
        <div>
          <span>{deviceKindLabels[kind]}</span>
          <h3>{device.name}</h3>
          <p>Номер устройства: {device.serial_number}</p>
          <time>{telemetry ? `Получено: ${formatDateTime(telemetry.retrieved_at)}` : 'Данные ещё не получены'}</time>
        </div>
        {rows.length ? (
          <dl>
            {rows.map(({ key, sample }) => (
              <div key={key}>
                <dt>{getTelemetryLabel(key)}</dt>
                <dd>{formatVisualValue(key, sample.value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="my-inline-warning">Показаний для визуального представления пока нет.</p>
        )}
      </div>
      {feedback && <p className="form-success my-device-visual-feedback">{feedback}</p>}
      {error && (
        <div className="my-device-visual-toast" role="alert">
          <span>{error}</span>
          <button aria-label="Закрыть сообщение" title="Закрыть" type="button" onClick={onDismissError}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function DeviceSettingsForm({
  device,
  greenhouses,
  onSave,
  onRequestDelete,
}: {
  device: Device;
  greenhouses: Greenhouse[];
  onSave: (device: Device, payload: DeviceUpdatePayload) => Promise<void>;
  onRequestDelete: () => void;
}) {
  const [name, setName] = useState(device.name);
  const [kind, setKind] = useState<DeviceKind>(getDeviceKind(device));
  const [greenhouseId, setGreenhouseId] = useState(
    device.greenhouse_id ? String(device.greenhouse_id) : ''
  );
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Заполните название устройства для сохранения.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onSave(device, {
        name: name.trim(),
        kind,
        ...(greenhouseId ? { greenhouseId: Number(greenhouseId) } : {}),
      });
    } catch (submitError) {
      setError(getFriendlyError(submitError, 'Попробуйте позже: устройство не удалось сохранить.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="my-form my-device-settings" noValidate onSubmit={handleSubmit}>
      <label>
        <span>Название устройства *</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="my-form__field">
        <span>Теплица</span>
        <Dropdown
          value={greenhouseId}
          onChange={setGreenhouseId}
          placeholder="Не распределено"
          options={[
            ...(device.greenhouse_id == null ? [{ value: '', label: 'Не распределено' }] : []),
            ...greenhouses.map((greenhouse) => ({
              value: String(greenhouse.id),
              label: greenhouse.name,
            })),
          ]}
        />
        <small>
          {device.greenhouse_id == null
            ? 'Можно оставить устройство нераспределенным или выбрать теплицу.'
            : 'Устройство можно переместить в другую теплицу.'}
        </small>
      </div>
      <fieldset className="my-type-options">
        <legend>Назначение устройства</legend>
        <small className="my-type-options__hint">
          Выберите назначение, указанное в паспорте или на самом устройстве.
        </small>
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
      <p className="my-device-settings__serial">Номер устройства: {device.serial_number}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="my-form__actions my-device-settings__actions">
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Сохраняем...' : 'Сохранить'}
        </button>
        <button className="danger-action" type="button" disabled={isSaving} onClick={onRequestDelete}>
          Удалить устройство
        </button>
      </footer>
    </form>
  );
}

function DeleteDeviceConfirm({
  device,
  onConfirm,
  onCancel,
}: {
  device: Device;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await onConfirm();
    } catch (deleteError) {
      setError(getFriendlyError(deleteError, 'Попробуйте позже: устройство не удалось удалить.'));
      setIsDeleting(false);
    }
  };

  return (
    <div className="my-confirm-dialog">
      <p>Удалить устройство «{device.name}»?</p>
      <p className="my-confirm-dialog__note">
        Позже вы сможете снова добавить его, указав номер с наклейки или паспорта устройства.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="my-confirm-dialog__actions">
        <button className="danger-action" type="button" disabled={isDeleting} onClick={handleDelete}>
          {isDeleting ? 'Удаляем...' : 'Подтвердить удаление'}
        </button>
        <button className="secondary-action" type="button" disabled={isDeleting} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function TemperatureAutomationPreview() {
  return (
    <section className="my-automation-panel" aria-labelledby="temperature-automation-title">
      <header className="my-automation-panel__header">
        <div>
          <h2 id="temperature-automation-title">Автоматизация температуры</h2>
          <p>Настройки автоматизации пока недоступны.</p>
        </div>
      </header>

      <div className="my-automation-panel__content">
        <label className="my-automation-switch">
          <span>
            <strong>Автоматический режим</strong>
            <p>После включения система будет поддерживать выбранную температуру, открывая и закрывая форточку.</p>
          </span>
          <span className="my-automation-switch__control">
            <input aria-label="Автоматический режим" disabled role="switch" type="checkbox" />
            <i aria-hidden="true" />
          </span>
        </label>

        <div className="my-automation-fields">
          <label>
            <span>Целевая температура</span>
            <div><input aria-label="Целевая температура" disabled type="number" value="25" readOnly /><span>°C</span></div>
          </label>
          <label>
            <span>Гистерезис</span>
            <div><input aria-label="Гистерезис" disabled type="number" value="2" readOnly /><span>°C</span></div>
          </label>
        </div>

        <div className="my-automation-thresholds">
          <div><span>Открытие форточки</span><strong>выше 26 °C</strong></div>
          <div><span>Закрытие форточки</span><strong>ниже 24 °C</strong></div>
        </div>
      </div>

      <footer>
        <button disabled type="button">Сохранить настройки</button>
      </footer>
    </section>
  );
}

function DeviceTelemetryPanel({
  device,
  telemetry,
  telemetryError,
  onCommand,
  greenhouses,
  onUpdate,
  onDelete,
}: {
  device: Device;
  telemetry?: DeviceTelemetry;
  telemetryError?: string;
  onCommand: (device: Device, command: DeviceCommand) => Promise<void>;
  greenhouses: Greenhouse[];
  onUpdate: (device: Device, payload: DeviceUpdatePayload) => Promise<void>;
  onDelete: (device: Device) => Promise<void>;
}) {
  const rows = getTelemetryRows(telemetry);
  const kind = getDeviceKind(device);
  const canControl = kind === 'actuator' || kind === 'valve';
  const [pendingCommand, setPendingCommand] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isVisualOpen, setIsVisualOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleCommand = async (command: DeviceCommand) => {
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
        <div className="my-device-card__header-actions">
          <time>{telemetry ? `Получено: ${formatDateTime(telemetry.retrieved_at)}` : 'нет данных'}</time>
          <div>
            <button className="secondary-action" type="button" onClick={() => setIsVisualOpen(true)}>
              Визуальное представление
            </button>
            <button className="secondary-action" type="button" disabled={!telemetry || !rows.length} onClick={() => setIsHistoryOpen(true)}>
              История показаний
            </button>
            <button className="secondary-action" type="button" onClick={() => setIsSettingsOpen(true)}>
              Настроить
            </button>
          </div>
        </div>
      </header>

      {telemetryError ? (
        <p className="my-inline-warning">{telemetryError}</p>
      ) : rows.length ? (
        <dl className="my-telemetry-grid">
          {rows.map(({ key, sample }) => (
            <div key={key}>
              <dt>{getTelemetryLabel(key)}</dt>
              <dd>{formatVisualValue(key, sample.value)}</dd>
              {(() => {
                const summary = getNumericTelemetrySummary(telemetry?.telemetry[key] || []);
                if (!summary) return null;
                const unit = getTelemetryUnit(key);
                return (
                  <span className="my-telemetry-grid__summary">
                    {summary.trend === 'up' ? 'Растет ↑' : summary.trend === 'down' ? 'Снижается ↓' : 'Без изменений'}
                    {' · '}{formatNumericValue(summary.min)}–{formatNumericValue(summary.max)} {unit}
                  </span>
                );
              })()}
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
      {feedback && !isVisualOpen && <p className="form-success">{feedback}</p>}
      {error && !isVisualOpen && <p className="form-error">{error}</p>}
      {isVisualOpen && (
        <Modal title="Визуальное представление" size="wide" onClose={() => setIsVisualOpen(false)}>
          <DeviceVisual
            device={device}
            kind={kind}
            rows={rows}
            telemetry={telemetry}
            pendingCommand={pendingCommand}
            feedback={feedback}
            error={error}
            onCommand={handleCommand}
            onDismissError={() => setError('')}
          />
        </Modal>
      )}
      {isHistoryOpen && telemetry && (
        <Modal title={`История: ${device.name}`} size="wide" onClose={() => setIsHistoryOpen(false)}>
          <TelemetryHistory telemetry={telemetry} />
        </Modal>
      )}
      {isSettingsOpen && (
        <Modal title="Настроить устройство" size="wide" onClose={() => setIsSettingsOpen(false)}>
          <DeviceSettingsForm
            device={device}
            greenhouses={greenhouses}
            onSave={async (currentDevice, payload) => {
              await onUpdate(currentDevice, payload);
              setIsSettingsOpen(false);
            }}
            onRequestDelete={() => setIsDeleteConfirmOpen(true)}
          />
        </Modal>
      )}
      {isDeleteConfirmOpen && (
        <Modal title="Удалить устройство" size="compact" onClose={() => setIsDeleteConfirmOpen(false)}>
          <DeleteDeviceConfirm
            device={device}
            onCancel={() => setIsDeleteConfirmOpen(false)}
            onConfirm={async () => {
              await onDelete(device);
              setIsDeleteConfirmOpen(false);
              setIsSettingsOpen(false);
            }}
          />
        </Modal>
      )}
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

  useEffect(() => {
    setDeviceKindFilter('all');
  }, [routeState.greenhouseId]);

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
        ([key]) => !['device_type', 'sensor_type', 'actuator_type'].includes(key)
      )
    );
    const updated = await requestJson<Device>(`/api/devices/${device.id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        metadata: { ...preservedMetadata, ...buildDeviceMetadata(payload.kind) },
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

  const sendCommand = async (device: Device, command: DeviceCommand) => {
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
                <span>Назначение устройства</span>
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
              {filteredGreenhouseDevices.length ? (
                filteredGreenhouseDevices.map((device) => (
                  <DeviceTelemetryPanel
                    key={device.id}
                    device={device}
                    telemetry={telemetry[device.id]}
                    telemetryError={telemetryErrors[device.id]}
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

        <TemperatureAutomationPreview />

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
          <DeviceCreateForm greenhouses={greenhouses} onSubmit={createDevice} />
        </Modal>
      )}
    </section>
  );
}

export default MyGreenhousesPage;
