/**
 * Distributes numbers 1-30 among N participants fairly.
 * Each participant gets floor(30/N) numbers, with remainder distributed randomly.
 *
 * @param participantIds - Array of participant IDs to distribute numbers to
 * @returns Map of participantId -> array of entry numbers (1-30)
 */
export function distributeNumbers(participantIds: string[]): Map<string, number[]> {
  const totalNumbers = 30;
  const numParticipants = participantIds.length;

  if (numParticipants === 0) {
    throw new Error("Cannot distribute numbers with no participants");
  }

  if (numParticipants > totalNumbers) {
    throw new Error("Too many participants for available numbers");
  }

  // Create array of numbers 1-30
  const numbers = Array.from({ length: totalNumbers }, (_, i) => i + 1);

  // Shuffle the numbers using Fisher-Yates algorithm
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  // Calculate distribution
  const baseCount = Math.floor(totalNumbers / numParticipants);
  const remainder = totalNumbers % numParticipants;

  // Shuffle participant order for fair remainder distribution
  const shuffledParticipants = [...participantIds];
  for (let i = shuffledParticipants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledParticipants[i], shuffledParticipants[j]] = [shuffledParticipants[j], shuffledParticipants[i]];
  }

  // Distribute numbers
  const distribution = new Map<string, number[]>();
  let numberIndex = 0;

  shuffledParticipants.forEach((participantId, idx) => {
    // Some participants get an extra number if there's a remainder
    const count = baseCount + (idx < remainder ? 1 : 0);
    const assignedNumbers = numbers.slice(numberIndex, numberIndex + count);
    distribution.set(participantId, assignedNumbers.sort((a, b) => a - b));
    numberIndex += count;
  });

  return distribution;
}

/**
 * Validates that a distribution is complete and fair
 */
export function validateDistribution(distribution: Map<string, number[]>): boolean {
  const allNumbers = new Set<number>();

  distribution.forEach((numbers) => {
    numbers.forEach(n => allNumbers.add(n));
  });

  // Check all 30 numbers are assigned exactly once
  if (allNumbers.size !== 30) return false;

  for (let i = 1; i <= 30; i++) {
    if (!allNumbers.has(i)) return false;
  }

  return true;
}
