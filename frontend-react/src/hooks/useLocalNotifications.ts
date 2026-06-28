import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Device, DeviceTelemetry, Greenhouse, User } from '../types';
import { requestJson } from '../utils/api';

export type LocalNotification = {
  id: string;
  type: 'welcome' | 'telemetry';
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  targetHash: string;
  actionLabel: string;
};

type Options = {
  token: string;
  user: User | null;
  isNotificationsOpen: boolean;
  onAuthExpired: () => void;
};

const STORAGE_VERSION = 'v1';
const WELCOME_VERSION = 'v2';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function hasMeaningfulValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'string') return true;

  const normalized = value.trim().toLowerCase();
  return !['', 'null', 'none', 'undefined', 'нет данных'].includes(normalized);
}

type DeviceTelemetryTimestamps = Record<string, number>;
type StoredTelemetryTimestamps = Record<string, number | DeviceTelemetryTimestamps>;

function getLatestTelemetryTimestamps(telemetry: DeviceTelemetry) {
  const latestByKey: DeviceTelemetryTimestamps = {};
  Object.entries(telemetry.telemetry).forEach(([key, samples]) => {
    samples.forEach((sample) => {
      if (
        hasMeaningfulValue(sample.value) &&
        Number.isFinite(sample.ts) &&
        sample.ts > (latestByKey[key] || 0)
      ) {
        latestByKey[key] = sample.ts;
      }
    });
  });
  return latestByKey;
}

function hasNewTelemetry(
  current: DeviceTelemetryTimestamps,
  previous?: number | DeviceTelemetryTimestamps
) {
  const currentEntries = Object.entries(current);
  if (!previous || !currentEntries.length) return false;
  if (typeof previous === 'number') {
    return currentEntries.some(([, timestamp]) => timestamp > previous);
  }
  return currentEntries.some(
    ([key, timestamp]) => previous[key] === undefined || timestamp > previous[key]
  );
}

function getTimestampSignature(timestamps: DeviceTelemetryTimestamps) {
  return Object.entries(timestamps)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, timestamp]) => `${key}:${timestamp}`)
    .join('|');
}

export function useLocalNotifications({
  token,
  user,
  isNotificationsOpen,
  onAuthExpired,
}: Options) {
  const userKey = user ? String(user.id || user.email) : '';
  const notificationsKey = useMemo(
    () => `greenhouse-notifications:${STORAGE_VERSION}:${userKey}`,
    [userKey]
  );
  const timestampsKey = useMemo(
    () => `greenhouse-telemetry-timestamps:${STORAGE_VERSION}:${userKey}`,
    [userKey]
  );
  const welcomeKey = useMemo(
    () => `greenhouse-welcome-shown:${WELCOME_VERSION}:${userKey}`,
    [userKey]
  );
  const welcomePendingKey = useMemo(
    () => `greenhouse-welcome-pending:${WELCOME_VERSION}:${userKey}`,
    [userKey]
  );
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const isScanRunning = useRef(false);

  const updateNotifications = useCallback(
    (
      updater: (current: LocalNotification[]) => LocalNotification[]
    ) => {
      setNotifications((current) => {
        const next = updater(current);
        if (userKey) localStorage.setItem(notificationsKey, JSON.stringify(next));
        return next;
      });
    },
    [notificationsKey, userKey]
  );

  useEffect(() => {
    if (!userKey) {
      setNotifications([]);
      return;
    }

    const stored = readStorage<LocalNotification[]>(notificationsKey, []).filter(
      (item) => item.type !== 'welcome' || item.id === 'welcome-v2'
    );
    localStorage.setItem(notificationsKey, JSON.stringify(stored));
    if (
      localStorage.getItem(welcomeKey) ||
      localStorage.getItem(welcomePendingKey) !== 'true'
    ) {
      setNotifications(stored);
      return;
    }

    const welcome: LocalNotification = {
      id: 'welcome-v2',
      type: 'welcome',
      title: 'Добро пожаловать в «Умную теплицу»',
      message:
        'В разделе «Мои теплицы» можно создавать теплицы, добавлять устройства и просматривать их показания.',
      createdAt: Date.now(),
      read: false,
      targetHash: '#/my-greenhouses',
      actionLabel: 'Перейти в «Мои теплицы»',
    };
    const next = [welcome, ...stored.filter((item) => item.id !== welcome.id)];
    localStorage.removeItem(welcomePendingKey);
    localStorage.setItem(welcomeKey, 'true');
    localStorage.setItem(notificationsKey, JSON.stringify(next));
    setNotifications(next);
  }, [notificationsKey, userKey, welcomeKey, welcomePendingKey]);

  const scanTelemetry = useCallback(async () => {
    if (!userKey || !token || isScanRunning.current) return;
    isScanRunning.current = true;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [greenhouses, devices] = await Promise.all([
        requestJson<Greenhouse[]>('/api/greenhouses/', { headers, onAuthExpired }),
        requestJson<Device[]>('/api/devices/', { headers, onAuthExpired }),
      ]);
      const greenhouseNames = new Map(
        greenhouses.map((greenhouse) => [greenhouse.id, greenhouse.name])
      );
      const timestamps = readStorage<StoredTelemetryTimestamps>(timestampsKey, {});
      const results = await Promise.allSettled(
        devices.map((device) =>
          requestJson<DeviceTelemetry>(`/api/telemetry/${device.id}`, {
            headers,
            onAuthExpired,
          })
        )
      );
      const discovered: LocalNotification[] = [];

      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const device = devices[index];
        const latestTimestamps = getLatestTelemetryTimestamps(result.value);
        if (!Object.keys(latestTimestamps).length) return;

        const previousTimestamps = timestamps[String(device.id)];
        if (
          hasNewTelemetry(latestTimestamps, previousTimestamps) &&
          device.greenhouse_id != null
        ) {
          const greenhouseName = greenhouseNames.get(device.greenhouse_id) || 'Теплица';
          discovered.push({
            id: `telemetry:${device.id}:${getTimestampSignature(latestTimestamps)}`,
            type: 'telemetry',
            title: `Новые данные: ${device.name}`,
            message: `В теплице «${greenhouseName}» обновились показания устройства «${device.name}».`,
            createdAt: Date.now(),
            read: isNotificationsOpen,
            targetHash: `#/my-greenhouses/${device.greenhouse_id}`,
            actionLabel: 'Открыть теплицу',
          });
        }

        timestamps[String(device.id)] =
          typeof previousTimestamps === 'object'
            ? { ...previousTimestamps, ...latestTimestamps }
            : latestTimestamps;
      });

      localStorage.setItem(timestampsKey, JSON.stringify(timestamps));
      if (discovered.length) {
        updateNotifications((current) => {
          const existingIds = new Set(current.map((item) => item.id));
          return [
            ...discovered.filter((item) => !existingIds.has(item.id)),
            ...current,
          ].sort((left, right) => right.createdAt - left.createdAt);
        });
      }
    } catch {
      // A failed background check must not block the rest of the application.
    } finally {
      isScanRunning.current = false;
    }
  }, [isNotificationsOpen, onAuthExpired, timestampsKey, token, updateNotifications, userKey]);

  useEffect(() => {
    scanTelemetry();
    const intervalId = window.setInterval(scanTelemetry, 120000);
    window.addEventListener('focus', scanTelemetry);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', scanTelemetry);
    };
  }, [scanTelemetry]);

  useEffect(() => {
    if (!isNotificationsOpen || !notifications.some((item) => !item.read)) return;
    updateNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, [isNotificationsOpen, notifications, updateNotifications]);

  const deleteNotification = useCallback(
    (id: string) => {
      updateNotifications((current) => current.filter((item) => item.id !== id));
    },
    [updateNotifications]
  );

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    deleteNotification,
  };
}
