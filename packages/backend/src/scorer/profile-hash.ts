import { createHash } from 'crypto';

export function computeProfileHash(
  resumeTexts: string[],
  profile: {
    targetSkills: string[];
    targetCerts: string[];
    targetTitles: string[];
  }
): string {
  const data = [
    ...resumeTexts,
    ...profile.targetSkills,
    ...profile.targetCerts,
    ...profile.targetTitles,
  ].join('|');
  return createHash('sha256').update(data).digest('hex');
}
