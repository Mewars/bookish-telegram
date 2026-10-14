export type TextSize = 'normal' | 'large' | 'extra';

export interface AccessibilityPreferences {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  hearingAssistance: boolean;
}

export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  textSize: 'normal',
  highContrast: false,
  reduceMotion: false,
  hearingAssistance: false,
};

export const ACCESSIBILITY_STORAGE_KEY = 'ryadom.accessibility.v1';

export function parseAccessibilityPreferences(raw: string | null): AccessibilityPreferences {
  if (!raw || raw.length > 2000) return { ...DEFAULT_ACCESSIBILITY };
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ...DEFAULT_ACCESSIBILITY };
    const value = data as Record<string, unknown>;
    return {
      textSize: value.textSize === 'large' || value.textSize === 'extra' ? value.textSize : 'normal',
      highContrast: value.highContrast === true,
      reduceMotion: value.reduceMotion === true,
      hearingAssistance: value.hearingAssistance === true,
    };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY };
  }
}
