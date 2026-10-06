import { Icon } from './Icon';
export function Search({ value, onChange, placeholder = 'События, места и маленькие открытия' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
 return <div className="search"><Icon name="search" size={21}/><input type="search" aria-label="Поиск" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>{value && <button aria-label="Очистить поиск" onClick={() => onChange('')}><Icon name="close" size={18}/></button>}</div>;
}
