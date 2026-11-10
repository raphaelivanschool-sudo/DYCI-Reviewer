import { useAuth } from './auth-context';
import type { Lang, UserProfile } from './types';

export type { Lang };

/** English is the default; Tagalog/Taglish only when the student picks it in the chat. */
export const langOf = (p: UserProfile | null | undefined): Lang => (p?.language === 'tl' ? 'tl' : 'en');

export function useLang(): Lang {
  return langOf(useAuth().profile);
}

/** Pick the line for the current language: tr(lang, 'Nice!', 'Galing!'). */
export const tr = (lang: Lang, en: string, tl: string) => (lang === 'tl' ? tl : en);
