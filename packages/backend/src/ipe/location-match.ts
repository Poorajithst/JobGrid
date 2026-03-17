export function scoreLocationMatch(targetLocations: string[], jobLocation: string | null): number {
  if (!jobLocation) return 50;

  const jobLower = jobLocation.toLowerCase().trim();
  const targets = targetLocations.map(l => l.toLowerCase().trim());

  // Check for remote
  if (jobLower.includes('remote') && targets.some(t => t === 'remote')) return 90;

  // Check for exact city match
  for (const target of targets) {
    if (target === 'remote') continue;
    if (jobLower.includes(target) || target.includes(jobLower)) return 100;
  }

  // Check for same state
  const jobState = extractState(jobLower);
  if (jobState) {
    for (const target of targets) {
      const targetState = extractState(target);
      if (targetState && targetState === jobState) return 70;
    }
  }

  // Remote job but profile doesn't list remote
  if (jobLower.includes('remote')) return 60;

  return 10;
}

function extractState(location: string): string | null {
  const match = location.match(/,\s*([a-z]{2})\b/);
  return match ? match[1] : null;
}
