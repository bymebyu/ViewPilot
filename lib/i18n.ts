import ko from "../locales/ko";
import en from "../locales/en";
import ja from "../locales/ja";
import zh from "../locales/zh";
import es from "../locales/es";

export const SUPPORTED_LOCALES = ["ko", "en", "ja", "zh", "es"] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

const messages: Record<SupportedLocale, Record<string, string>> = { ko, en, ja, zh, es };

export function resolveLocale(raw: string): SupportedLocale {
  const base = raw.split("-")[0].toLowerCase();
  if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) return base as SupportedLocale;
  return "en";
}

export function t(locale: SupportedLocale, key: string, params?: Record<string, string | number>): string {
  let text = messages[locale]?.[key] ?? messages["en"][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
