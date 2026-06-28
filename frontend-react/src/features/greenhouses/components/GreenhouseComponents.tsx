import { useState } from 'react';
import type { Greenhouse } from '../../../types';
import { getFriendlyError } from '../model/errors';
import type { FieldErrors } from '../model/types';

export function GreenhouseForm({
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

export function DeleteGreenhouseConfirm({
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

export function GreenhouseCard({ greenhouse }: { greenhouse: Greenhouse }) {
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
