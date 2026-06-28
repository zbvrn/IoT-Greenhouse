export default function TemperatureAutomationPreview() {
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
