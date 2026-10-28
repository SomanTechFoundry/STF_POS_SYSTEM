import { normalizeLocale } from "../modules/i18n/i18n.service.js";

export function localeMiddleware(req, _res, next) {
  const headerLocale = req.headers["x-locale"] || req.headers["accept-language"];
  req.locale = normalizeLocale(headerLocale);
  next();
}

