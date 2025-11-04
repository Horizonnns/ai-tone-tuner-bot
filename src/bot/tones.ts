export type TToneKey =
  | "business"
  | "friendly"
  | "hype"
  | "inspire"
  | "persuasive"
  | "humorous";

export interface IToneOption {
  key: TToneKey;
  label: string;
}

export const TONES: IToneOption[] = [
  { key: "business", label: "💼 Деловой" },
  { key: "friendly", label: "💬 Дружелюбный" },
  { key: "hype", label: "🚀 Хайповый" },
  { key: "inspire", label: "✨ Вдохновляющий" },
  { key: "persuasive", label: "🧠 Убедительный" },
  { key: "humorous", label: "😄 С юмором" },
];

export function toneLabel(key: string): string {
  const map: Record<string, string> = {
    business: "💼 деловой профессиональный стиль",
    friendly: "💬 дружелюбный лёгкий тон",
    hype: "🚀 современный и хайповый стиль",
    inspire: "✨ вдохновляющий стиль",
    persuasive: "🧠 убедительный тон",
    humorous: "😄 с юмором",
  };
  return map[key] || key;
}

export type KeyboardMode = "collapsed" | "expanded";

export function buildToneKeyboard(mode: KeyboardMode = "collapsed") {
  const base = TONES.slice(0, 4).map((t) => [
    { text: t.label, callback_data: `tone_${t.key}` },
  ]);
  if (mode === "collapsed") {
    return [...base, [{ text: "➕ Ещё стили", callback_data: "tone_more" }]];
  }
  const extra = TONES.slice(4).map((t) => [
    { text: t.label, callback_data: `tone_${t.key}` },
  ]);

  return [
    ...base,
    ...extra,
    [{ text: "✏️ Свой стиль", callback_data: "tone_custom" }],
    [{ text: "⬅️ Меньше", callback_data: "tone_less" }],
  ];
}
