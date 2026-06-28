import { useEffect, useId, useRef, useState } from 'react';
import type { SelectOption } from '../../features/greenhouses/model/types';

export default function Dropdown({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  placement = 'down',
  inlineMenu = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  placement?: 'up' | 'down';
  inlineMenu?: boolean;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const open = () => {
    if (disabled) return;
    setActiveIndex(Math.max(selectedIndex, 0));
    setIsOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setActiveIndex(index);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) =>
        Math.min(Math.max(current + direction, 0), Math.max(options.length - 1, 0))
      );
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) choose(activeIndex);
      else open();
    }
  };

  return (
    <div
      className={`my-select my-select--${placement}${inlineMenu ? ' my-select--inline-menu' : ''}${isOpen ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={!selectedOption ? 'is-placeholder' : ''}
        disabled={disabled}
        role="combobox"
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <span className="my-select__chevron" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="my-select__menu" id={listboxId} role="listbox">
          {options.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={index === activeIndex ? 'is-active' : ''}
              key={option.value}
              role="option"
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
