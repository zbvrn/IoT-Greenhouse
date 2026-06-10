import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AutomationSetting, Greenhouse } from '../../types';
import { getRequestErrorMessage } from '../../utils/errors';

type CreateGreenhouseFormProps = {
  onCreate: (payload: { name: string; location?: string }) => Promise<Greenhouse>;
  onCreated?: (greenhouse: Greenhouse) => void;
};

export function CreateGreenhouseForm({ onCreate, onCreated }: CreateGreenhouseFormProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!name.trim()) {
      setError('Введите название теплицы.');
      return;
    }

    setIsSaving(true);
    try {
      const greenhouse = await onCreate({
        name: name.trim(),
        location: location.trim() || undefined,
      });
      onCreated?.(greenhouse);
      setName('');
      setLocation('');
      setMessage('Теплица создана.');
    } catch (submitError) {
      setError(getRequestErrorMessage(submitError, 'Не удалось создать теплицу.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="module-panel">
      <div className="section-heading section-heading--tight">
        <h2>Новая теплица</h2>
        <p>Создайте рабочее пространство, к которому будут привязываться устройства и автоматика.</p>
      </div>

      <form className="compact-form" onSubmit={handleSubmit}>
        <label>
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            placeholder="Например, Южная теплица"
            required
          />
        </label>
        <label>
          Локация
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            type="text"
            placeholder="Участок 12, крайняя грядка"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Создаём...' : 'Создать теплицу'}
        </button>
      </form>
    </section>
  );
}

type DeviceCreateFormProps = {
  greenhouseId?: number | null;
  greenhouses: Greenhouse[];
  onCreate: (payload: {
    name: string;
    serial_number: string;
    greenhouse_id?: number | null;
  }) => Promise<unknown>;
};

export function DeviceCreateForm({ greenhouseId, greenhouses, onCreate }: DeviceCreateFormProps) {
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [targetGreenhouseId, setTargetGreenhouseId] = useState(
    greenhouseId != null ? String(greenhouseId) : ''
  );
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (greenhouseId != null) {
      setTargetGreenhouseId(String(greenhouseId));
    }
  }, [greenhouseId]);

  const targetLabel = useMemo(() => {
    if (greenhouseId != null) return 'Текущая теплица';
    return 'Теплица для привязки';
  }, [greenhouseId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!name.trim()) {
      setError('Введите название устройства.');
      return;
    }

    if (!serialNumber.trim()) {
      setError('Введите серийный номер или Device ID.');
      return;
    }

    setIsSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        serial_number: serialNumber.trim(),
        greenhouse_id: targetGreenhouseId ? Number(targetGreenhouseId) : greenhouseId ?? null,
      });
      setName('');
      setSerialNumber('');
      setMessage('Устройство добавлено.');
    } catch (submitError) {
      setError(
        getRequestErrorMessage(
          submitError,
          'Не удалось добавить устройство. Проверьте Device ID и попробуйте ещё раз.'
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="module-panel">
      <div className="section-heading section-heading--tight">
        <h2>Добавить устройство</h2>
        <p>
          Введите номер с наклейки, паспорта или QR-кода. Система проверит, зарегистрировано ли
          устройство и можно ли привязать его к вашему аккаунту.
        </p>
      </div>

      <form className="compact-form" onSubmit={handleSubmit}>
        <label>
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            placeholder="Форточка север"
            required
          />
        </label>
        <label>
          Серийный номер / Device ID
          <input
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
            type="text"
            placeholder="С наклейки или QR-кода"
            required
          />
        </label>
        <p className="hint-text">
          Вводите номер без лишних пробелов. Если устройство уже включали, проверьте блок
          нераспределённых устройств.
        </p>
        <label>
          {targetLabel}
          <select
            value={targetGreenhouseId}
            onChange={(event) => setTargetGreenhouseId(event.target.value)}
            disabled={greenhouseId != null}
          >
            <option value="">Без привязки</option>
            {greenhouses.map((greenhouse) => (
              <option key={greenhouse.id} value={greenhouse.id}>
                {greenhouse.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Добавляем...' : 'Добавить устройство'}
        </button>
      </form>
    </section>
  );
}

type EditGreenhouseFormProps = {
  greenhouse: Greenhouse;
  onSave: (greenhouseId: number, payload: { name?: string; location?: string; is_active?: boolean }) => Promise<Greenhouse>;
  onDelete: (greenhouseId: number) => Promise<void>;
};

export function EditGreenhouseForm({ greenhouse, onSave, onDelete }: EditGreenhouseFormProps) {
  const [name, setName] = useState(greenhouse.name);
  const [location, setLocation] = useState(greenhouse.location || '');
  const [isActive, setIsActive] = useState(greenhouse.is_active);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setName(greenhouse.name);
    setLocation(greenhouse.location || '');
    setIsActive(greenhouse.is_active);
  }, [greenhouse]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSaving(true);

    try {
      await onSave(greenhouse.id, {
        name: name.trim(),
        location: location.trim() || undefined,
        is_active: isActive,
      });
      setMessage('Теплица обновлена.');
    } catch (submitError) {
      setError(getRequestErrorMessage(submitError, 'Не удалось сохранить теплицу.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Удалить теплицу? Это действие нельзя отменить.')) return;
    setIsDeleting(true);
    setError('');
    setMessage('');

    try {
      await onDelete(greenhouse.id);
    } catch (submitError) {
      setError(getRequestErrorMessage(submitError, 'Не удалось удалить теплицу.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="module-panel">
      <div className="section-heading section-heading--tight">
        <h2>Сведения о теплице</h2>
      </div>

      <form className="compact-form" onSubmit={handleSubmit}>
        <label>
          Название
          <input value={name} onChange={(event) => setName(event.target.value)} type="text" required />
        </label>
        <label>
          Локация
          <input value={location} onChange={(event) => setLocation(event.target.value)} type="text" />
        </label>
        <label className="checkbox-row">
          <input
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            type="checkbox"
          />
          <span>Теплица активна</span>
        </label>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <div className="form-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Удаляем...' : 'Удалить'}
          </button>
        </div>
      </form>
    </section>
  );
}

type EditAutomationFormProps = {
  greenhouseId: number;
  automation: AutomationSetting;
  onSave: (
    greenhouseId: number,
    payload: {
      auto_mode?: boolean;
      target_temperature?: number;
      hysteresis?: number;
    }
  ) => Promise<AutomationSetting>;
};

export function EditAutomationForm({
  greenhouseId,
  automation,
  onSave,
}: EditAutomationFormProps) {
  const [autoMode, setAutoMode] = useState(automation.auto_mode);
  const [targetTemperature, setTargetTemperature] = useState(String(automation.target_temperature));
  const [hysteresis, setHysteresis] = useState(String(automation.hysteresis));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAutoMode(automation.auto_mode);
    setTargetTemperature(String(automation.target_temperature));
    setHysteresis(String(automation.hysteresis));
  }, [automation]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSaving(true);

    try {
      await onSave(greenhouseId, {
        auto_mode: autoMode,
        target_temperature: Number(targetTemperature),
        hysteresis: Number(hysteresis),
      });
      setMessage('Настройки автоматики сохранены.');
    } catch (submitError) {
      setError(getRequestErrorMessage(submitError, 'Не удалось сохранить автоматику.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="module-panel">
      <div className="section-heading section-heading--tight">
        <h2>Автоматика</h2>
        <p>Задайте целевую температуру и чувствительность реакции системы.</p>
      </div>

      <form className="compact-form" onSubmit={handleSubmit}>
        <label className="checkbox-row">
          <input checked={autoMode} onChange={(event) => setAutoMode(event.target.checked)} type="checkbox" />
          <span>Включить автоматический режим</span>
        </label>
        <label>
          Целевая температура
          <input
            value={targetTemperature}
            onChange={(event) => setTargetTemperature(event.target.value)}
            type="number"
            min={10}
            max={40}
            step="0.1"
            required
          />
        </label>
        <label>
          Гистерезис
          <input
            value={hysteresis}
            onChange={(event) => setHysteresis(event.target.value)}
            type="number"
            min={0.5}
            max={10}
            step="0.1"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Сохраняем...' : 'Сохранить автоматику'}
        </button>
      </form>
    </section>
  );
}
