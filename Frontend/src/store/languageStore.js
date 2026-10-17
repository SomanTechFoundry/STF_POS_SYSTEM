import { create } from "zustand";

const defaultLanguage = "en";

export const useLanguageStore = create((set) => ({
  language: localStorage.getItem("appLanguage") || defaultLanguage,
  setLanguage: (language) => {
    localStorage.setItem("appLanguage", language);
    set({ language });
  }
}));