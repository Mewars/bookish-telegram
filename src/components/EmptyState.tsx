import { Icon } from './Icon';
export function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
 return <div className="empty-state"><span><Icon name="search" size={30}/></span><h2>{title}</h2><p>{text}</p>{action && <button className="primary-button" onClick={onAction}>{action}</button>}</div>;
}
