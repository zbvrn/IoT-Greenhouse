import { useState } from 'react';
import Dropdown from '../../../components/ui/Dropdown';
import type { Device, Greenhouse } from '../../../types';
import { componentRoleLabels, deviceKindLabels } from '../model/constants';
import {
  buildDeviceMetadata,
  getActuatorSettings,
  getComponentRole,
  getDeviceKind,
  getIrrigationSettings,
  getSystemId,
  getSystemName,
} from '../model/devices';
import { getFriendlyError } from '../model/errors';
import type { DeviceComponentRole, DeviceKind, DeviceUpdatePayload, FieldErrors } from '../model/types';
import Modal from './Modal';

export function DeviceCreateForm({
  greenhouses,
  devices,
  fixedGreenhouseId,
  onSubmit,
}: {
  greenhouses: Greenhouse[];
  devices: Device[];
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
  const [kind, setKind] = useState<DeviceKind>('climate_control');
  const [componentRole, setComponentRole] = useState<DeviceComponentRole>('sensor');
  const [systemId, setSystemId] = useState('new');
  const [greenhouseId, setGreenhouseId] = useState(
    fixedGreenhouseId ? String(fixedGreenhouseId) : ''
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const targetGreenhouseId = fixedGreenhouseId || (greenhouseId ? Number(greenhouseId) : null);
  const existingSystems = Array.from(
    new Map(
      devices
        .filter(
          (device) =>
            device.greenhouse_id === targetGreenhouseId && getDeviceKind(device) === kind
        )
        .map((device) => [getSystemId(device), getSystemName(device)])
    )
  );

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
        metadata: buildDeviceMetadata(kind, {
          componentRole,
          systemId:
            kind === 'other'
              ? undefined
              : systemId === 'new'
                ? `${kind}-${Date.now()}`
                : systemId,
          systemName:
            kind === 'other'
              ? undefined
              : systemId === 'new'
                ? name.trim()
                : existingSystems.find(([id]) => id === systemId)?.[1],
        }),
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
        <legend>Тип системы</legend>
        <small className="my-type-options__hint">
          Выберите систему, частью которой будет это устройство.
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
      {kind !== 'other' && (
        <div className="my-device-system-fields">
          <div className="my-form__field">
            <span>Тип устройства</span>
            <Dropdown
              value={componentRole}
              onChange={(value) => setComponentRole(value as DeviceComponentRole)}
              placeholder="Выберите тип устройства"
              options={Object.entries(componentRoleLabels[kind]).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>
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
          <div className={`my-form__field${fixedGreenhouseId === undefined ? ' my-device-system-fields__system' : ''}`}>
            <span>Система теплицы</span>
            <Dropdown
              value={systemId}
              onChange={setSystemId}
              placeholder="Выберите систему"
              options={[
                { value: 'new', label: 'Создать новую систему' },
                ...existingSystems.map(([id, label]) => ({ value: id, label })),
              ]}
            />
          </div>
        </div>
      )}
      {kind === 'other' && fixedGreenhouseId === undefined && (
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

export function AssignDeviceForm({
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

export function UnassignedDeviceCard({
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

export function DeviceSettingsForm({
  device,
  greenhouses,
  onSave,
  onRequestDelete,
  lockAssignment = false,
}: {
  device: Device;
  greenhouses: Greenhouse[];
  onSave: (device: Device, payload: DeviceUpdatePayload) => Promise<void>;
  onRequestDelete: () => void;
  lockAssignment?: boolean;
}) {
  const [name, setName] = useState(device.name);
  const [kind, setKind] = useState<DeviceKind>(getDeviceKind(device));
  const initialActuatorSettings = getActuatorSettings(device);
  const [strokeLength, setStrokeLength] = useState(initialActuatorSettings.strokeLength);
  const [strokeSpeed, setStrokeSpeed] = useState(initialActuatorSettings.strokeSpeed);
  const [valveOpenPercent, setValveOpenPercent] = useState(
    getIrrigationSettings(device).valveOpenPercent
  );
  const [greenhouseId, setGreenhouseId] = useState(
    device.greenhouse_id ? String(device.greenhouse_id) : ''
  );
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isClimateActuator = kind === 'climate_control' && getComponentRole(device) === 'actuator';
  const isIrrigationActuator = kind === 'soil_irrigation' && getComponentRole(device) === 'actuator';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Заполните название устройства для сохранения.');
      return;
    }
    if (
      isClimateActuator &&
      (!Number.isFinite(strokeLength) ||
        strokeLength <= 0 ||
        !Number.isFinite(strokeSpeed) ||
        strokeSpeed <= 0)
    ) {
      setError('Укажите положительные значения хода и скорости привода.');
      return;
    }
    if (
      isIrrigationActuator &&
      (!Number.isFinite(valveOpenPercent) || valveOpenPercent <= 0 || valveOpenPercent > 100)
    ) {
      setError('Укажите лимит открытия клапана от 1 до 100%.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onSave(device, {
        name: name.trim(),
        kind,
        ...(greenhouseId ? { greenhouseId: Number(greenhouseId) } : {}),
        ...(isClimateActuator ? { strokeLength, strokeSpeed } : {}),
        ...(isIrrigationActuator ? { valveOpenPercent } : {}),
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
      {!lockAssignment && <div className="my-form__field">
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
      </div>}
      {!lockAssignment && <fieldset className="my-type-options">
        <legend>Тип системы</legend>
        <small className="my-type-options__hint">
          Выберите систему, частью которой является устройство.
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
      </fieldset>}
      {isClimateActuator && (
        <fieldset className="my-device-settings__parameters">
          <legend>Параметры управления форточкой</legend>
          <p>Укажите полный ход штока и скорость движения привода.</p>
          <div className="my-device-settings__actuator">
            <label>
              <span>Ход привода</span>
              <div>
                <input
                  aria-label="Ход привода"
                  min="1"
                  step="1"
                  type="number"
                  value={strokeLength}
                  onChange={(event) => setStrokeLength(Number(event.target.value))}
                />
                <span>мм</span>
              </div>
            </label>
            <label>
              <span>Скорость привода</span>
              <div>
                <input
                  aria-label="Скорость привода"
                  min="0.1"
                  step="0.1"
                  type="number"
                  value={strokeSpeed}
                  onChange={(event) => setStrokeSpeed(Number(event.target.value))}
                />
                <span>мм/с</span>
              </div>
            </label>
          </div>
        </fieldset>
      )}
      {isIrrigationActuator && (
        <fieldset className="my-device-settings__parameters">
          <legend>Параметры управления поливом</legend>
          <p>Укажите максимальный уровень открытия клапана.</p>
          <div className="my-device-settings__actuator">
            <label>
              <span>Лимит открытия клапана</span>
              <div>
                <input
                  aria-label="Лимит открытия клапана"
                  min="1"
                  max="100"
                  step="1"
                  type="number"
                  value={valveOpenPercent}
                  onChange={(event) => setValveOpenPercent(Number(event.target.value))}
                />
                <span>%</span>
              </div>
            </label>
          </div>
        </fieldset>
      )}
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

export function DeleteDeviceConfirm({
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
