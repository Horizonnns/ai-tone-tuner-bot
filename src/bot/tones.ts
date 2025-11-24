import { userLang } from "../locales";
import { i18n } from "../locales";

export type TToneKey =
  | "business"
  | "friendly"
  | "hype"
  | "inspire"
  | "persuasive"
  | "humorous";

export function toneLabel(key: string, userId: string): string {
  // Если userId === "default", используем русский язык
  const lang = userId === "default" ? "ru" : userLang.get(userId) || "ru";
  const t = i18n[lang];
  return t.tones.list[key] || key;
}

export function buildLocalizedToneKeyboard(
  userId: string,
  mode: "collapsed" | "expanded"
) {
  const lang = userLang.get(userId) || "ru";
  const t = i18n[lang].tones.list;

  const base = [
    [{ text: t.business, callback_data: "tone_business" }],
    [{ text: t.friendly, callback_data: "tone_friendly" }],
    [{ text: t.hype, callback_data: "tone_hype" }],
    [{ text: t.inspire, callback_data: "tone_inspire" }],
  ];

  const extra = [
    [{ text: t.persuasive, callback_data: "tone_persuasive" }],
    [{ text: t.humorous, callback_data: "tone_humorous" }],
  ];

  if (mode === "collapsed") {
    return [...base, [{ text: t.more, callback_data: "tone_more" }]];
  }

  return [
    ...base,
    ...extra,
    [{ text: t.custom, callback_data: "tone_custom" }],
    [{ text: t.less, callback_data: "tone_less" }],
  ];
}

export function localizedToneHeader(userId: string) {
  const lang = userLang.get(userId) || "ru";
  return i18n[lang].tones.header;
}
