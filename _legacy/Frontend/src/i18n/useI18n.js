import { useCallback } from "react";
import { useLanguageStore } from "../store/languageStore";
import { translations } from "./translations";

function resolveKey(source, key) {
  return key.split(".").reduce((acc, part) => acc?.[part], source);
}

export function useI18n() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const t = useCallback((key, vars = {}) => {
    const activeDict = translations[language] || translations.en;
    const fallbackDict = translations.en;
    const activeValue = resolveKey(activeDict, key);
    const fallbackValue = resolveKey(fallbackDict, key);
    const template = typeof activeValue === "string" ? activeValue : fallbackValue;

    if (typeof template !== "string") {
      return key;
    }

    return template.replace(/\{(\w+)\}/g, (_match, varName) => {
      return vars[varName] !== undefined ? String(vars[varName]) : `{${varName}}`;
    });
  }, [language]);

  return { language, setLanguage, t };
}
