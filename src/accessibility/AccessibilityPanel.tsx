import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_ACCESSIBILITY, type AccessibilityPreferences, type TextSize } from './preferences';
import './accessibility.css';

interface AccessibilityPanelProps {
  open: boolean;
  onClose: () => void;
  preferences: AccessibilityPreferences;
  onChange: (next: AccessibilityPreferences) => void;
  onReset: () => void;
}

export function AccessibilityButton({ onClick, mobile = false }: {
  onClick: () => void;
  mobile?: boolean;
}) {
  return <button type="button" className="accessibility-button accessibility-button--fixed"
    onClick={onClick} aria-label="Версия для слабовидящих и слабослышащих. Настройки доступности"
    aria-haspopup="dialog" aria-controls="ryadom-accessibility-dialog" title="Настройки доступности">Аа</button>;
}

export function AccessibilityPanel({ open, onClose, preferences, onChange, onReset }: AccessibilityPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  const set = (key: keyof AccessibilityPreferences, value: boolean) =>
    onChange({ ...preferences, [key]: value });
  const selectTextSize = (value: TextSize) => onChange({ ...preferences, textSize: value });

  return createPortal(<dialog
    ref={dialogRef}
    id="ryadom-accessibility-dialog"
    className="accessibility-dialog"
    aria-labelledby="accessibility-title"
    aria-describedby="accessibility-intro"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
  >
    <div className="accessibility-dialog-head">
      <div><span className="accessibility-eyebrow">РЯДОМ · УДОБНО ДЛЯ ВСЕХ</span>
        <h2 id="accessibility-title">Настройки доступности</h2></div>
      <button className="accessibility-close" type="button" onClick={onClose} aria-label="Закрыть настройки">✕</button>
    </div>
    <p id="accessibility-intro" className="accessibility-intro">Настройте отображение и подсказки под себя. Выбранные параметры сохраняются в этом браузере.</p>

    <fieldset className="accessibility-field">
      <legend>Размер текста</legend>
      <div className="accessibility-choices">
        {([{ id: 'normal', label: 'Обычный' }, { id: 'large', label: 'Крупный' }, { id: 'extra', label: 'Очень крупный' }] as const)
          .map(option => <button key={option.id} type="button" aria-pressed={preferences.textSize === option.id}
            onClick={() => selectTextSize(option.id)}>{option.label}</button>)}
      </div>
    </fieldset>
    <label className="accessibility-option">
      <span><strong>Высокая контрастность</strong><small>Тёмный фон, светлый текст и заметные границы</small></span>
      <input type="checkbox" checked={preferences.highContrast} onChange={event => set('highContrast', event.target.checked)}/>
    </label>
    <label className="accessibility-option">
      <span><strong>Меньше анимации</strong><small>Убирает движения и плавные переходы</small></span>
      <input type="checkbox" checked={preferences.reduceMotion} onChange={event => set('reduceMotion', event.target.checked)}/>
    </label>
    <label className="accessibility-option">
      <span><strong>Для слабослышащих</strong><small>Показывает состояние музыки текстом и пояснения о звуковом контенте</small></span>
      <input type="checkbox" checked={preferences.hearingAssistance} onChange={event => set('hearingAssistance', event.target.checked)}/>
    </label>
    {preferences.hearingAssistance && <p className="accessibility-hearing-note" role="status">
      Музыку можно включить и выключить самостоятельно. Прямой радиоэфир не имеет текстовой расшифровки;
      субтитры к видео RUTUBE зависят от самого видео.
    </p>}
    <div className="accessibility-actions">
      <button className="accessibility-reset" type="button" onClick={() => { onReset(); }}>Сбросить настройки</button>
      <button className="accessibility-done" type="button" onClick={onClose}>Готово</button>
    </div>
    {JSON.stringify(preferences) === JSON.stringify(DEFAULT_ACCESSIBILITY) && <span className="sr-only">Используются настройки по умолчанию</span>}
  </dialog>, document.body);
}
