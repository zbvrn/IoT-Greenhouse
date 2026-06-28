import { useState } from 'react';
import Dropdown from '../../../components/ui/Dropdown';
import type { Device, Greenhouse } from '../../../types';
import { deviceKindLabels } from '../model/constants';
import { buildDeviceMetadata, getDeviceKind } from '../model/devices';
import { getFriendlyError } from '../model/errors';
import type { DeviceKind, DeviceUpdatePayload, FieldErrors } from '../model/types';
import Modal from './Modal';

export function DeviceCreateForm({
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
