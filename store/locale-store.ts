import { create } from "zustand";
import { resolveLocale, SUPPORTED_LOCALES } from "../lib/i18n";
import { storageLocalGet, storageLocalSet } from "../lib/browser-api";
import type { SupportedLocale } from "../lib/i18n";

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  initLocale: () => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",

  setLocale: (locale) => {
    set({ locale });
    storageLocalSet({ userLocale: locale });
  },

  initLocale: async () => {
    const result = await storageLocalGet("userLocale");
    if (result.userLocale && (SUPPORTED_LOCALES as readonly string[]).includes(result.userLocale)) {
      set({ locale: result.userLocale as SupportedLocale });
    } else {
      const raw = (chrome.i18n?.getUILanguage?.() ?? navigator.language ?? "en");
      set({ locale: resolveLocale(raw) });
    }
  },
}));
