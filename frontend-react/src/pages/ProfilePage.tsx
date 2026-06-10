import { FormEvent, useEffect, useState } from 'react';
import type { User } from '../types';
import { getErrorMessage, getRequestErrorMessage } from '../utils/errors';
import { getDisplayName } from '../utils/user';

type ProfilePageProps = {
  token: string;
  user: User | null;
  onUserUpdate: (user: User) => void;
  onAuthExpired: () => void;
  onLogout: () => void;
};

function ProfilePage({ token, user, onUserUpdate, onAuthExpired, onLogout }: ProfilePageProps) {
  const [profileUser, setProfileUser] = useState<User | null>(user);
  const [nameDraft, setNameDraft] = useState(user?.full_name?.trim() || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setLoadError('');
      setIsLoadingProfile(true);

      try {
        const response = await fetch('/api/profile/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            onAuthExpired();
            return;
          }

          throw new Error(await getErrorMessage(response, 'Не удалось загрузить профиль.'));
        }

        const data = (await response.json()) as User;
        if (!isMounted) return;
        setProfileUser(data);
        setNameDraft(data.full_name?.trim() || '');
        onUserUpdate(data);
      } catch (error) {
        if (isMounted) {
          setLoadError(getRequestErrorMessage(error, 'Не удалось загрузить профиль.'));
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [onAuthExpired, onUserUpdate, token]);

  const currentUser = profileUser || user;
  const currentName = getDisplayName(currentUser);
  const email = currentUser?.email || 'Email не указан';
  const initials = currentName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');

    const nextName = nameDraft.trim();
    if (!nextName) {
      setProfileError('Введите имя.');
      return;
    }

    setIsSavingName(true);

    try {
      const response = await fetch('/api/profile/', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full_name: nextName }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onAuthExpired();
          return;
        }

        throw new Error(await getErrorMessage(response, 'Не удалось сохранить изменения.'));
      }

      const data = (await response.json()) as User;
      setProfileUser(data);
      onUserUpdate(data);
      setNameDraft(data.full_name?.trim() || '');
      setIsEditingName(false);
      setProfileMessage('Данные профиля обновлены.');
    } catch (error) {
      setProfileError(getRequestErrorMessage(error, 'Не удалось сохранить изменения.'));
    } finally {
      setIsSavingName(false);
    }
  };

  const cancelNameEdit = () => {
    setNameDraft(currentUser?.full_name?.trim() || '');
    setProfileError('');
    setProfileMessage('');
    setIsEditingName(false);
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (password.length < 6) {
      setPasswordError('Пароль должен быть не короче 6 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Пароли не совпадают.');
      return;
    }

    setIsSavingPassword(true);

    try {
      const response = await fetch('/api/profile/', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onAuthExpired();
          return;
        }

        throw new Error(await getErrorMessage(response, 'Не удалось изменить пароль.'));
      }

      const data = (await response.json()) as User;
      setProfileUser(data);
      onUserUpdate(data);
      setPassword('');
      setConfirmPassword('');
      setPasswordMessage('Пароль обновлён.');
    } catch (error) {
      setPasswordError(getRequestErrorMessage(error, 'Не удалось изменить пароль.'));
    } finally {
      setIsSavingPassword(false);
    }
  };

  const cancelPasswordEdit = () => {
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordMessage('');
  };

  return (
    <div className="profile-page">
      {isLoadingProfile && <p className="status-note">Загружаем данные профиля...</p>}
      {loadError && <p className="form-error">{loadError}</p>}

      <section className="profile-panel profile-hero" aria-labelledby="profile-info-title">
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">
            {initials || 'UT'}
          </span>
          <div>
            <h2 id="profile-info-title">{currentName}</h2>
            <p>{email}</p>
          </div>
        </div>

        {!isEditingName && (
          <button className="secondary-action" type="button" onClick={() => setIsEditingName(true)}>
            Изменить имя
          </button>
        )}
      </section>

      {isEditingName && (
        <section className="profile-panel" aria-label="Редактирование имени">
          <form className="profile-form" onSubmit={saveName}>
            <label>
              Имя пользователя
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                type="text"
                placeholder="Иван Петров"
                required
              />
            </label>
            {profileError && <p className="form-error">{profileError}</p>}
            {profileMessage && <p className="form-success">{profileMessage}</p>}
            <div className="form-actions">
              <button type="submit" disabled={isSavingName}>
                {isSavingName ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={cancelNameEdit}
                disabled={isSavingName}
              >
                Отмена
              </button>
            </div>
          </form>
        </section>
      )}

      {!isEditingName && (profileError || profileMessage) && (
        <section className="profile-feedback">
          {profileError && <p className="form-error">{profileError}</p>}
          {profileMessage && <p className="form-success">{profileMessage}</p>}
        </section>
      )}

      <section className="profile-panel" aria-labelledby="password-title">
        <div className="section-heading">
          <h2 id="password-title">Смена пароля</h2>
        </div>

        <form className="profile-form" onSubmit={savePassword}>
          <div className="form-columns">
            <label>
              Новый пароль
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Минимум 6 символов"
                minLength={6}
                required
              />
            </label>
            <label>
              Повтор пароля
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                placeholder="Повторите пароль"
                minLength={6}
                required
              />
            </label>
          </div>
          {passwordError && <p className="form-error">{passwordError}</p>}
          {passwordMessage && <p className="form-success">{passwordMessage}</p>}
          <div className="form-actions">
            <button type="submit" disabled={isSavingPassword}>
              {isSavingPassword ? 'Обновляем...' : 'Обновить пароль'}
            </button>
            <button
              className="secondary-action"
              type="button"
              onClick={cancelPasswordEdit}
              disabled={isSavingPassword || (!password && !confirmPassword)}
            >
              Отмена
            </button>
          </div>
        </form>
      </section>

      <section className="profile-panel session-panel" aria-labelledby="session-title">
        <div className="section-heading">
          <h2 id="session-title">Сессия</h2>
          <p>Завершите работу с аккаунтом на этом устройстве.</p>
        </div>
        <button className="secondary-action" type="button" onClick={onLogout}>
          Выйти из аккаунта
        </button>
      </section>
    </div>
  );
}

export default ProfilePage;
