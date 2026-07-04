import type { LocalNotification } from '../hooks/useLocalNotifications';

type Props = {
  notifications: LocalNotification[];
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
};

function formatNotificationTime(value: number) {
  return new Date(value).toLocaleString('ru-RU');
}

function NotificationsPage({ notifications, onDelete, onDeleteAll }: Props) {
  return (
    <section className="notifications-page">
      <header className="notifications-page__header">
        <div>
          <h1>Уведомления</h1>
          <p>Здесь сохраняются сообщения о новых данных устройств.</p>
        </div>
        {notifications.length > 0 && (
          <button className="secondary-action" type="button" onClick={onDeleteAll}>
            Удалить все
          </button>
        )}
      </header>

      {notifications.length ? (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <article
              className={`notification-item${notification.read ? '' : ' is-unread'}`}
              key={notification.id}
            >
              <div className="notification-item__content">
                <time>{formatNotificationTime(notification.createdAt)}</time>
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
                <a href={notification.targetHash}>{notification.actionLabel}</a>
              </div>
              <button
                className="secondary-action"
                type="button"
                onClick={() => onDelete(notification.id)}
              >
                Удалить
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="notifications-empty">
          <p>Уведомлений пока нет.</p>
        </div>
      )}
    </section>
  );
}

export default NotificationsPage;
