export function scoreTitleAlignment(
  targetTitles: string[],
  jobTitle: string,
  synonyms: Record<string, string[]>
): number {
  const jobLower = jobTitle.toLowerCase().trim();
  let bestScore = 0;

  for (const target of targetTitles) {
    const targetLower = target.toLowerCase().trim();

    // Exact match
    if (jobLower === targetLower) return 100;

    // Contains match (job title contains target or vice versa)
    if (jobLower.includes(targetLower) || targetLower.includes(jobLower)) {
      bestScore = Math.max(bestScore, 85);
      continue;
    }

    // Word overlap
    const targetWords = targetLower.split(/\s+/);
    const jobWords = jobLower.split(/\s+/);
    const overlap = targetWords.filter(w => jobWords.includes(w)).length;
    const overlapRatio = overlap / Math.max(targetWords.length, 1);
    if (overlapRatio >= 0.5) {
      bestScore = Math.max(bestScore, 60);
      continue;
    }

    // Synonym match
    const targetSynonyms = synonyms[targetLower] || [];
    for (const syn of targetSynonyms) {
      if (jobLower.includes(syn.toLowerCase()) || syn.toLowerCase().includes(jobLower)) {
        bestScore = Math.max(bestScore, 40);
        break;
      }
    }
  }

  return bestScore;
}
