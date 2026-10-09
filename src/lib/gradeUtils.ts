/**
 * Grade Conversion Utilities
 * Convert 0-3 scale grades to alpha grades and achievement levels
 */

import { AlphaGrade, AchievementLevel, GradeRangeMapping, GradeScale } from '@/types/assessment';

/**
 * Grade range mapping for CBC 0-3 scale to alpha grades
 * Based on Ugandan curriculum standards
 */
export const GRADE_RANGE_MAPPINGS: GradeRangeMapping[] = [
  {
    alphaGrade: 'A',
    minScore: 2.7,
    maxScore: 3.0,
    achievementLevel: 'Excellent',
    description: 'Exceeds expectations; demonstrates mastery',
  },
  {
    alphaGrade: 'B',
    minScore: 2.4,
    maxScore: 2.6,
    achievementLevel: 'Very Good',
    description: 'Meets expectations; demonstrates solid competency',
  },
  {
    alphaGrade: 'C',
    minScore: 2.0,
    maxScore: 2.3,
    achievementLevel: 'Good',
    description: 'Meets basic expectations; developing competency',
  },
  {
    alphaGrade: 'D',
    minScore: 1.5,
    maxScore: 1.9,
    achievementLevel: 'Fair',
    description: 'Partially meets expectations; needs improvement',
  },
  {
    alphaGrade: 'E',
    minScore: 0,
    maxScore: 1.4,
    achievementLevel: 'Below Average',
    description: 'Does not meet expectations; significant support needed',
  },
];

/**
 * Convert a 0-3 scale score to an alpha grade (A-E)
 */
export function scoreToAlphaGrade(score: GradeScale | undefined): AlphaGrade | undefined {
  if (score === undefined || score === null) return undefined;

  const numScore = Number(score);
  const mapping = GRADE_RANGE_MAPPINGS.find(
    (m) => numScore >= m.minScore && numScore <= m.maxScore
  );

  return mapping?.alphaGrade;
}

/**
 * Convert a 0-3 scale score to achievement level
 */
export function scoreToAchievementLevel(score: GradeScale | undefined): AchievementLevel | undefined {
  if (score === undefined || score === null) return undefined;

  const numScore = Number(score);
  const mapping = GRADE_RANGE_MAPPINGS.find(
    (m) => numScore >= m.minScore && numScore <= m.maxScore
  );

  return mapping?.achievementLevel;
}

/**
 * Convert 0-3 scale score to 0-20 scale for report cards
 * Formula: (score / 3) * 20
 */
export function scoreToOutOf20(score: GradeScale | undefined): number | undefined {
  if (score === undefined || score === null) return undefined;

  const numScore = Number(score);
  if (numScore < 0 || numScore > 3) return undefined;

  return Math.round((numScore / 3) * 20 * 100) / 100; // Round to 2 decimal places
}

/**
 * Validate if a score is within 0-3 range
 */
export function isValidScore(score: GradeScale | undefined): boolean {
  if (score === undefined || score === null) return false;

  const numScore = Number(score);
  return !isNaN(numScore) && numScore >= 0 && numScore <= 3;
}

/**
 * Calculate average of multiple scores, ignoring undefined values
 */
export function calculateAverageScore(scores: (GradeScale | undefined)[]): GradeScale | undefined {
  const validScores = scores.filter((s) => isValidScore(s)) as GradeScale[];

  if (validScores.length === 0) return undefined;

  const sum = validScores.reduce((acc, score) => acc + Number(score), 0);
  const average = sum / validScores.length;

  return Math.round(average * 100) / 100; // Round to 2 decimal places
}

/**
 * Get description for a grade mapping
 */
export function getGradeDescription(alphaGrade: AlphaGrade): string {
  const mapping = GRADE_RANGE_MAPPINGS.find((m) => m.alphaGrade === alphaGrade);
  return mapping?.description || '';
}

/**
 * Format score as string with proper decimal places
 */
export function formatScore(score: GradeScale | undefined, maxDecimals: number = 1): string {
  if (score === undefined || score === null) return '—';

  const numScore = Number(score);
  if (!isValidScore(numScore)) return '—';

  return numScore.toFixed(maxDecimals).replace(/\.?0+$/, '');
}
