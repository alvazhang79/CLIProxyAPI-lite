import { en } from './en';
import { zh } from './zh';

export type Lang = 'en' | 'zh';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Strings = Record<string, any>;

const strings: Record<Lang, Strings> = { en, zh };

/**
 * Detect language from Accept-Language header.
 * Defaults to 'en'. Supports 'zh', 'zh-CN', 'zh-TW', etc.
 */
export function detectLang(header: string | null | undefined): Lang {
  if (!header) return 'en';
  if (header.includes('zh')) return 'zh';
  return 'en';
}

/**
 * Get the best matching language string for an Accept-Language header.
 */
export function i18n(header: string | null | undefined): Strings {
  return strings[detectLang(header)];
}

export { en, zh };
