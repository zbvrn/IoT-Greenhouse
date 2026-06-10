import type { Greenhouse } from '../../types';
import { formatDateTime } from '../../pages/greenhouses/greenhouseHelpers';

type GreenhouseCardProps = {
  greenhouse: Greenhouse;
  deviceCount: number;
};

function GreenhouseCard({ greenhouse, deviceCount }: GreenhouseCardProps) {
  return (
    <a className="greenhouse-card" href={`#/greenhouses/${greenhouse.id}`}>
      <div className="greenhouse-card__topline">
        <div>
          <h3>{greenhouse.name}</h3>
          <p>{greenhouse.location || 'Локация не указана'}</p>
        </div>
        <span className={greenhouse.is_active ? 'status-pill' : 'status-pill status-pill--muted'}>
          {greenhouse.is_active ? 'Активна' : 'Неактивна'}
        </span>
      </div>

      <dl className="greenhouse-card__stats">
        <div>
          <dt>Устройств</dt>
          <dd>{deviceCount}</dd>
        </div>
        <div>
          <dt>Обновлено</dt>
          <dd>{formatDateTime(greenhouse.updated_at)}</dd>
        </div>
      </dl>
    </a>
  );
}

export default GreenhouseCard;
