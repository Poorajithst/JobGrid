export function scoreExperience(candidateYears: number, jobDescription: string): number {
  const jobLower = jobDescription.toLowerCase();

  // Extract years requirement from job description
  const yearsMatch = jobLower.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:\w+\s+)*?(?:experience|exp)/);
  if (!yearsMatch) return 70; // No requirement stated

  const required = parseInt(yearsMatch[1]);
  const diff = candidateYears - required;

  if (diff >= 0 && diff <= 2) return 100;  // Perfect match
  if (diff > 2 && diff <= 4) return 80;    // Slightly over-qualified
  if (diff > 4) return 40;                  // Significantly over-qualified
  if (diff >= -2) return 50;               // Under-qualified by 1-2 years
  return 20;                                // Significantly under-qualified
}
