import { useEffect } from 'react';

export default function Modal({
  title,
  children,
  onClose,
  size = 'regular',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'compact' | 'regular' | 'wide';
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="my-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className={`my-modal my-modal--${size}`}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="my-modal__header">
          <h2>{title}</h2>
          <button aria-label="Закрыть" type="button" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
