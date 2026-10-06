import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { availableCities } from '../data/cities';
import { Icon } from './Icon';

interface CityPickerProps {
  city: string;
  selectCity: (city: string) => void;
  onDismiss: () => void;
  storageError: boolean;
}

export function CityPicker({ city, selectCity, onDismiss, storageError }: CityPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="city-sheet"
      aria-labelledby="city-sheet-title"
      aria-describedby="city-sheet-description"
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      onCancel={event => { event.preventDefault(); onDismiss(); }}
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) onDismiss();
      }}
    >
      <div className="sheet-handle" aria-hidden="true"/>
      <div className="city-sheet-heading">
        <div><span className="eyebrow">ВСЁ ХОРОШЕЕ РЯДОМ</span><h2 id="city-sheet-title">Выбери свой город</h2></div>
        <button className="sheet-close" aria-label="Закрыть выбор города" onClick={onDismiss}><Icon name="close" size={20}/></button>
      </div>
      <p id="city-sheet-description">Места, события и люди поблизости.</p>
      <div className="city-options" role="group" aria-label="Доступные города">
        {availableCities.map(option => (
          <button key={option.name} className="city-option" aria-pressed={city === option.name} onClick={() => selectCity(option.name)}>
            <span className="city-option-icon"><Icon name="pin" size={24}/></span>
            <span className="city-option-text"><strong>{option.name}</strong><small>{option.region}</small></span>
            {city === option.name && <span className="city-selected"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><small>Выбран</small></span>}
          </button>
        ))}
      </div>
      <p className="city-coming-soon">Другие города скоро появятся</p>
      {storageError && <p className="city-storage-error" role="status">Браузер запретил сохранение города. Выбор доступен до закрытия приложения.</p>}
      <button className="primary-button city-confirm" onClick={onDismiss}>Готово <Icon name="arrow" size={18}/></button>
    </dialog>,
    document.body,
  );
}
