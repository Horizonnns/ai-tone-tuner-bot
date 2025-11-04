// Простое состояние ожидания пользовательского тона
const awaitingCustomTone = new Set<number>();

export function setAwaitingCustomTone(userId: number, value: boolean) {
  if (value) awaitingCustomTone.add(userId);
  else awaitingCustomTone.delete(userId);
}

export function isAwaitingCustomTone(userId: number): boolean {
  return awaitingCustomTone.has(userId);
}

export function clearAwaitingCustomTone(userId: number) {
  awaitingCustomTone.delete(userId);
}
