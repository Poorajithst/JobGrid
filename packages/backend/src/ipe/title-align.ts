/**
 * Score title alignment with synonym support, exclude filtering,
 * and order-independent word matching.
 *
 * Scoring tiers:
 *  100 — exact match or synonym match
 *   90 — all significant words present (order-independent)
 *   85 — contains match (substring)
 *    0 — exclude match (overrides all)
 *  0-80 — partial word overlap (fallback)
 */
export function scoreTitleAlignment(
  targetTitles: string[],
  jobTitle: string,
  synonyms: Record<string, string[]>,
  excludeTitles: string[] = []
): number {
  const jobLower = jobTitle.toLowerCase().trim().replace(/[^\w\s]/g, '');
  const stopWords = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'in', 'at', 'for']);

  // Check excludes first — overrides everything
  for (const exclude of excludeTitles) {
    const excludeLower = exclude.toLowerCase().trim();
    if (jobLower === excludeLower || jobLower.includes(excludeLower)) {
      return 0;
    }
  }

  let bestScore = 0;

  for (const target of targetTitles) {
    const targetLower = target.toLowerCase().trim().replace(/[^\w\s]/g, '');

    // Exact match
    if (jobLower === targetLower) return 100;

    // Synonym match — keys are always lowercase
    const targetSynonyms = synonyms[targetLower] || [];
    for (const syn of targetSynonyms) {
      const synLower = syn.toLowerCase().trim();
      if (jobLower === synLower || jobLower.includes(synLower) || synLower.includes(jobLower)) {
        return 100;
      }
    }

    // Order-independent: all significant words from target appear in job title
    const targetWords = targetLower.split(/\s+/).filter(w => !stopWords.has(w));
    const jobWords = new Set(jobLower.split(/\s+/));
    const allPresent = targetWords.every(w => jobWords.has(w));
    if (allPresent && targetWords.length > 0) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }

    // Contains match
    if (jobLower.includes(targetLower) || targetLower.includes(jobLower)) {
      bestScore = Math.max(bestScore, 85);
      continue;
    }

    // Partial word overlap
    const overlap = targetWords.filter(w => jobWords.has(w)).length;
    const overlapRatio = overlap / Math.max(targetWords.length, 1);
    const overlapScore = Math.round(overlapRatio * 80);
    bestScore = Math.max(bestScore, overlapScore);
  }

  return bestScore;
}
