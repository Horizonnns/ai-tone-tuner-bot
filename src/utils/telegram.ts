import { userLang, i18n } from "../locales";

export function buildPremiumUrl(telegramId: number | string): string {
  return `${process.env.BACKEND_URL}/api/payments/create?telegramId=${telegramId}`;
}

export function isLocalhostUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

export function premiumReplyMarkup(
  url: string,
  userId?: string
): undefined | { reply_markup: { inline_keyboard: { text: string; url: string }[][] } } {
  if (isLocalhostUrl(url)) return undefined;
  const lang = userId ? userLang.get(userId) || "ru" : "ru";
  const t = i18n[lang];
  return {
    reply_markup: { inline_keyboard: [[{ text: t.premium.button, url }]] },
  };
}
