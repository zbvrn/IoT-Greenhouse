export default function LoadingState() {
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
