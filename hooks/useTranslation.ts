import { useLocaleStore } from "../store/locale-store";
import { t as translate, SUPPORTED_LOCALES } from "../lib/i18n";
import type { SupportedLocale } from "../lib/i18n";

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
  es: "Español",
};

export { SUPPORTED_LOCALES };
export type { SupportedLocale };

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, key, params);
  return { t, locale, setLocale };
}
