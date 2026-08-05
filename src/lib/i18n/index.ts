import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import ta from "./locales/ta.json";

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "हि" },
  { code: "ta", label: "தமிழ்", short: "த" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_STORAGE_KEY = "civicpulse.lang";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      ta: { translation: ta },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnObjects: true,
    react: { useSuspense: false },
  });
}

export function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return LANGUAGES.some((l) => l.code === v) ? (v as LanguageCode) : "en";
}

export function setLanguage(code: LanguageCode) {
  i18n.changeLanguage(code);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    document.documentElement.lang = code;
  }
}

export default i18n;
