import { userLang, i18n } from "../locales";

export function premiumOfferText(premiumUrl: string, userId?: string): string {
  const lang = userId ? userLang.get(userId) || "ru" : "ru";
  const t = i18n[lang];
  return t.premium.offer(premiumUrl);
}

export function limitReachedText(premiumUrl: string, userId?: string): string {
  const lang = userId ? userLang.get(userId) || "ru" : "ru";
  const t = i18n[lang];
  return t.limit.reached(premiumUrl);
}
