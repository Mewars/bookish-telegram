import { useEffect, useState } from 'react';
import {
  ACCESSIBILITY_STORAGE_KEY, DEFAULT_ACCESSIBILITY,
  parseAccessibilityPreferences, type AccessibilityPreferences,
} from './preferences';

function initialPreferences(): AccessibilityPreferences {
  try { return parseAccessibilityPreferences(window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY)); }
  catch { return { ...DEFAULT_ACCESSIBILITY }; }
}

export function useAccessibility() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(initialPreferences);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.a11yText = preferences.textSize;
    root.dataset.a11yContrast = preferences.highContrast ? 'high' : 'normal';
    root.dataset.a11yMotion = preferences.reduceMotion ? 'reduce' : 'normal';
    root.dataset.a11yHearing = preferences.hearingAssistance ? 'on' : 'off';
    try { window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences)); }
    catch { /* Private browsing may deny storage: settings still work in this tab. */ }
  }, [preferences]);

  const reset = () => setPreferences({ ...DEFAULT_ACCESSIBILITY });
  return { preferences, setPreferences, reset };
}
