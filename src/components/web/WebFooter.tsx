import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { readCityAccess } from '../../admin/repository';
import { canManageCity } from '../../admin/model';
import type { Section } from '../../types';
import { FooterBrand, FooterCooperation } from '../FooterBrand';
import { LegalLinks } from '../legal/LegalLinks';

export function WebFooter({ city, region, navigate }: { city: string; region: string; navigate: (section: Section) => void }) {
  const { state } = useAuth();
  const userId = state.user?.id;
  const [allowed, setAllowed] = useState<{userId:string;city:string} | null>(null);
  useEffect(() => {
    if (!userId || !supabase) return;
    let active = true;
    void readCityAccess(supabase, userId).then(rows => {
      if (active) setAllowed(canManageCity(rows, city) ? {userId, city} : null);
    }).catch(() => { if (active) setAllowed(null); });
    return () => { active = false; };
  }, [userId, city]);
  const canOpenAdmin = state.status === 'authenticated' && allowed?.userId === userId && allowed?.city === city;
  return (
    <footer className="web-footer">
      <div className="web-footer-inner">
        <FooterBrand city={city} region={region} goHome={() => navigate('home')} />
        <div className="footer-column footer-legal">
          <h2>Информация</h2>
          <LegalLinks />
        </div>
        <div className="footer-column">
          <h2>Сделаем город ближе</h2>
          <FooterCooperation showLegal={false} />
        </div>
        <div className="web-footer-note">
          <span>© 2026 Рядом. Все права защищены.</span>
          {canOpenAdmin && <button className="footer-admin-link" type="button" onClick={() => navigate('admin')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span>Административная панель</span>
          </button>}
        </div>
      </div>
    </footer>
  );
}
