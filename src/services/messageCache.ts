// Простой in-memory кэш для последних сообщений пользователей
const cache = new Map<number, string>();

export function setUserMessage(userId: number, text: string) {
  cache.set(userId, text);
}

export function getUserMessage(userId: number): string | undefined {
  return cache.get(userId);
}

export function deleteUserMessage(userId: number) {
  cache.delete(userId);
}
