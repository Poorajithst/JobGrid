export function scoreFreshness(postedAt: string | null): number {
  if (!postedAt) return 40;

  const now = Date.now();
  const posted = new Date(postedAt).getTime();
  const hoursAgo = (now - posted) / (1000 * 60 * 60);

  if (hoursAgo < 6) return 100;
  if (hoursAgo < 24) return 95;
  if (hoursAgo < 48) return 72;
  if (hoursAgo < 72) return 52;
  if (hoursAgo < 168) return 25; // 7 days
  if (hoursAgo < 336) return 10; // 14 days
  return 0;
}
