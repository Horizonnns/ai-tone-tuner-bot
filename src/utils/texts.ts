import { isLocalhostUrl } from "./telegram";

export function premiumOfferText(premiumUrl: string): string {
  const base =
    "💎 Хочешь безлимитные переписывания и эксклюзивные стили?\n\n" +
    "👉 Поддержи проект и получи *AI Tone Writer Premium* на 30 дней.\n\n" +
    "Стоимость: *199₽* 💰";
  return (
    base + (isLocalhostUrl(premiumUrl) ? `\n\nСсылка для оплаты: ${premiumUrl}` : "")
  );
}

export function limitReachedText(premiumUrl: string): string {
  const base =
    "🔥 Ты выжал максимум из бесплатного плана. Завтра — новая энергия! 💪\n\n" +
    "💎 Хочешь без ограничений и новых стилей? Подключи Premium ✨";
  return (
    base + (isLocalhostUrl(premiumUrl) ? `\n\nСсылка для оплаты: ${premiumUrl}` : "")
  );
}
