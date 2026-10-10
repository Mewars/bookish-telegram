import { MusicButton } from '../../music/MusicPlayer';
import { BrandMark } from '../BrandMark';
import type { Section } from '../../types';
import { Icon } from '../Icon';

interface WebHeaderProps {
  city: string;
  section: Section;
  navigate: (section: Section) => void;
  favoritesCount: number;
  cityPickerOpen: boolean;
  openCityPicker: () => void;
}

export function WebHeader({ city, section, navigate, favoritesCount, cityPickerOpen, openCityPicker }: WebHeaderProps) {
  return <header className="web-header"><div className="web-header-inner">
    <button className="brand" onClick={() => navigate('home')} aria-label="Рядом — на главную">РЯДОМ<BrandMark/></button>
    <button className="city-pill" onClick={openCityPicker} aria-label={`Выбрать город: ${city}`} aria-haspopup="dialog" aria-expanded={cityPickerOpen}><Icon name="pin" size={14}/>{city}<span className="city-chevron" aria-hidden="true"><Icon name="back" size={12}/></span></button>
    <nav className="web-nav" aria-label="Основная навигация">{([
      { id: 'home', label: 'Главная' }, { id: 'events', label: 'Афиша' }, { id: 'places', label: 'Места' }, { id: 'services', label: 'Услуги' },
    ] as const).map(tab => <button key={tab.id} data-section={tab.id} aria-current={section === tab.id ? 'page' : undefined} onClick={() => navigate(tab.id)}>{tab.label}</button>)}</nav>
    <div className="web-header-actions"><MusicButton/>
      <button className="web-favorites" onClick={() => navigate('favorites')} aria-current={section === 'favorites' ? 'page' : undefined}><Icon name="heart" size={19}/>Избранное{favoritesCount > 0 && <span>{favoritesCount}</span>}</button>
      <button className="web-profile-button" aria-label="Открыть профиль" aria-current={section === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}><Icon name="profile" size={20}/></button>
    </div>
  </div></header>;
}
