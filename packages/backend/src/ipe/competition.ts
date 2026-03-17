export function scoreCompetition(applicants: number | null): number {
  if (applicants === null) return 50;
  if (applicants < 10) return 100;
  if (applicants < 25) return 85;
  if (applicants < 50) return 60;
  if (applicants < 100) return 30;
  return 10;
}
