export type TToneKey = "business" | "friendly" | "hype" | "inspire";

export interface IToneOption {
  key: TToneKey;
  label: string;
}

export const TONES: IToneOption[] = [
  { key: "business", label: "💼 Деловой" },
  { key: "friendly", label: "💬 Дружелюбный" },
  { key: "hype", label: "🚀 Хайповый" },
  { key: "inspire", label: "✨ Вдохновляющий" },
];

export function toneLabel(key: string): string {
  const map: Record<string, string> = {
    business: "💼 деловой профессиональный стиль",
    friendly: "💬 дружелюбный лёгкий тон",
    hype: "🚀 современный и хайповый стиль",
    inspire: "✨ вдохновляющий стиль",
  };
  return map[key] || key;
}
