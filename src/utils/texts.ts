import { isLocalhostUrl } from "./telegram";

export function premiumOfferText(premiumUrl: string): string {
  const base =
    "💎 Открой безлимитные переписывания ✨\n\n" +
    "👉 Оформи *AI Tone Tuner Premium* на 30 дней и пиши без ограничений.\n\n";
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
