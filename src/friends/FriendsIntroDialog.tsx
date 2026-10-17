import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FriendsMascot } from './FriendsMascot';
import { Icon } from '../components/Icon';

/** Shown after tapping the friends shortcut; never requests location permission. */
export function FriendsIntroDialog({ onDismiss, onOpen }: { onDismiss: () => void; onOpen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return createPortal(<dialog ref={ref} className="friends-intro-dialog"
    aria-labelledby="friends-intro-title" aria-describedby="friends-intro-description"
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
    }}>
    <button type="button" className="friends-intro-close" aria-label="Закрыть информацию о друзьях" onClick={onDismiss}>
      <Icon name="close" size={19}/>
    </button>
    <div className="friends-intro-art" aria-hidden="true">
      <span className="friends-intro-orbit friends-intro-orbit-one"/>
      <span className="friends-intro-orbit friends-intro-orbit-two"/>
      <span className="friends-intro-friend friends-intro-friend-one"><span/></span>
      <span className="friends-intro-friend friends-intro-friend-two"><span/></span>
      <span className="friends-intro-pin"><Icon name="pin" size={16}/></span>
      <FriendsMascot size={164} className="friends-intro-robot"/>
      <span className="friends-intro-spark friends-intro-spark-one">✦</span>
      <span className="friends-intro-spark friends-intro-spark-two">✧</span>
    </div>
    <span className="friends-intro-kicker">ТВОИ ЛЮДИ — РЯДОМ</span>
    <h2 id="friends-intro-title">Друзья рядом</h2>
    <p id="friends-intro-description" className="friends-intro-lead">Вы открыли новый раздел «РЯДОМ». Приглашайте знакомых по личному коду и смотрите на карте, кто из подтверждённых друзей решил поделиться местоположением.</p>
    <div className="friends-intro-facts">
      <p><span aria-hidden="true">♡</span><span>Добавляйте друзей только по взаимному согласию.</span></p>
      <p><span aria-hidden="true">⌖</span><span>Ваше местоположение по умолчанию скрыто. Вы сами включаете приблизительную точку на один час.</span></p>
    </div>
    <button type="button" className="friends-intro-primary" onClick={onOpen}>Открыть друзей <Icon name="arrow" size={19}/></button>
    <button type="button" className="friends-intro-secondary" onClick={onDismiss}>Понятно</button>
  </dialog>, document.body);
}
