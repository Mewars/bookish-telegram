import { Icon } from '../components/Icon';
import './music.css';

// Navigate to the broadcaster; do not embed or request its audio stream.
export function MusicButton() {
  return <a className="music-launch" href="https://www.radiorecord.ru/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label="Радио — официальный сайт Radio Record, откроется в новой вкладке"><Icon name="music" size={18}/><span>Радио</span></a>;
}
