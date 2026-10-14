import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import './legal.css';
interface LegalPageProps {
  title: string;
  version: string;
  updatedAt?: string;
  goBack: () => void;
  children: ReactNode;
}
export function LegalPage({ title, version, updatedAt = '09.10.2026', goBack, children }: LegalPageProps) {
  return <><button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад</button><article className="legal-document"><h1>{title}</h1><p className="legal-document-meta">Версия документа: {version} · Дата редакции: {updatedAt}</p>{children}<button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад</button></article></>;
}
