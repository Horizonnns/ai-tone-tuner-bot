// Простой in-memory кэш для последних сообщений пользователей
const cache = new Map<number, string>();
const keyboardMessageCache = new Map<number, number>();

export function setUserMessage(userId: number, text: string) {
  cache.set(userId, text);
}

export function getUserMessage(userId: number): string | undefined {
  return cache.get(userId);
}

export function deleteUserMessage(userId: number) {
  cache.delete(userId);
}

export function setKeyboardMessageId(userId: number, messageId: number) {
  keyboardMessageCache.set(userId, messageId);
}

export function getKeyboardMessageId(userId: number): number | undefined {
  return keyboardMessageCache.get(userId);
}

export function deleteKeyboardMessageId(userId: number) {
  keyboardMessageCache.delete(userId);
}
