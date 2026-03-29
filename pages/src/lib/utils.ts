// Utility functions

export function generateRandomString(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(len);
  crypto.getRandomValues(array);
  return Array.from(array).map(x => chars[x % chars.length]).join('');
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
