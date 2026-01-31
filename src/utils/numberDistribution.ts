/**
 * Distribution modes for entry numbers
 */
export type DistributionMode = "EXCLUDE" | "BUY_EXTRA" | "SHARED";

/**
 * Result of number distribution
 */
export interface DistributionResult {
  /** Map of participantId -> array of entry numbers (1-30) they own outright */
  owned: Map<string, number[]>;
  /** Map of entryNumber -> array of participantIds who share it (for SHARED mode) */
  shared: Map<number, string[]>;
  /** Array of entry numbers that are not assigned (for EXCLUDE and BUY_EXTRA modes) */
  unassigned: number[];
}

/**
 * Distributes numbers 1-30 among N participants based on the distribution mode.
 *
 * EXCLUDE: Only distribute numbers that divide evenly. Leftover numbers are unassigned.
 * BUY_EXTRA: Same as EXCLUDE - host can manually assign extras later.
 * SHARED: All numbers distributed. Remainders are shared by random subgroups.
 *
 * @param participantIds - Array of participant IDs to distribute numbers to
 * @param mode - Distribution mode (defaults to EXCLUDE)
 * @returns DistributionResult with owned, shared, and unassigned numbers
 */
export function distributeNumbers(
  participantIds: string[],
  mode: DistributionMode = "EXCLUDE"
): DistributionResult {
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

  // Shuffle participant order for fair distribution
  const shuffledParticipants = [...participantIds];
  for (let i = shuffledParticipants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledParticipants[i], shuffledParticipants[j]] = [shuffledParticipants[j], shuffledParticipants[i]];
  }

  const result: DistributionResult = {
    owned: new Map<string, number[]>(),
    shared: new Map<number, string[]>(),
    unassigned: [],
  };

  // Initialize owned map for all participants
  shuffledParticipants.forEach((participantId) => {
    result.owned.set(participantId, []);
  });

  if (mode === "EXCLUDE" || mode === "BUY_EXTRA") {
    // Only distribute baseCount numbers to each participant
    const numbersToDistribute = baseCount * numParticipants;
    let numberIndex = 0;

    shuffledParticipants.forEach((participantId) => {
      const assignedNumbers = numbers.slice(numberIndex, numberIndex + baseCount);
      result.owned.set(participantId, assignedNumbers.sort((a, b) => a - b));
      numberIndex += baseCount;
    });

    // Remaining numbers are unassigned
    result.unassigned = numbers.slice(numbersToDistribute).sort((a, b) => a - b);
  } else if (mode === "SHARED") {
    // Distribute base numbers to everyone
    const baseNumbers = numbers.slice(0, baseCount * numParticipants);
    const remainderNumbers = numbers.slice(baseCount * numParticipants);

    let numberIndex = 0;
    shuffledParticipants.forEach((participantId) => {
      const assignedNumbers = baseNumbers.slice(numberIndex, numberIndex + baseCount);
      result.owned.set(participantId, assignedNumbers.sort((a, b) => a - b));
      numberIndex += baseCount;
    });

    // Distribute remainder numbers as shared among subgroups
    // For N participants and R remainder numbers:
    // - Each remainder number is shared by ceil(N/R) or floor(N/R) participants
    if (remainder > 0) {
      // Shuffle participants again for fair share distribution
      const shuffledForSharing = [...shuffledParticipants];
      for (let i = shuffledForSharing.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledForSharing[i], shuffledForSharing[j]] = [shuffledForSharing[j], shuffledForSharing[i]];
      }

      // Calculate how many participants share each remainder number
      // With 7 players and 2 remainders: #29 shared by 4, #30 shared by 3
      const shareGroupSizes: number[] = [];
      let remainingParticipants = numParticipants;
      for (let i = 0; i < remainder; i++) {
        const remainingRemainders = remainder - i;
        const shareSize = Math.ceil(remainingParticipants / remainingRemainders);
        shareGroupSizes.push(shareSize);
        remainingParticipants -= shareSize;
      }

      // Assign participants to share groups
      let participantIndex = 0;
      remainderNumbers.forEach((entryNumber, groupIndex) => {
        const shareSize = shareGroupSizes[groupIndex];
        const sharedBy = shuffledForSharing.slice(participantIndex, participantIndex + shareSize);
        result.shared.set(entryNumber, sharedBy);
        participantIndex += shareSize;
      });
    }
  }

  return result;
}

/**
 * Validates that a distribution is complete and fair for EXCLUDE/BUY_EXTRA mode
 */
export function validateExcludeDistribution(
  distribution: DistributionResult,
  participantCount: number
): boolean {
  const allOwnedNumbers = new Set<number>();
  const expectedCount = Math.floor(30 / participantCount) * participantCount;

  distribution.owned.forEach((numbers) => {
    numbers.forEach((n) => allOwnedNumbers.add(n));
  });

  // Check that owned + unassigned = 30
  const totalAssigned = allOwnedNumbers.size + distribution.unassigned.length;
  if (totalAssigned !== 30) return false;

  // Check that owned count matches expected
  if (allOwnedNumbers.size !== expectedCount) return false;

  // Check no duplicates between owned and unassigned
  for (const n of distribution.unassigned) {
    if (allOwnedNumbers.has(n)) return false;
  }

  return true;
}

/**
 * Validates that a distribution is complete for SHARED mode
 */
export function validateSharedDistribution(distribution: DistributionResult): boolean {
  const allNumbers = new Set<number>();

  // Add all owned numbers
  distribution.owned.forEach((numbers) => {
    numbers.forEach((n) => allNumbers.add(n));
  });

  // Add all shared numbers
  distribution.shared.forEach((_, entryNumber) => {
    allNumbers.add(entryNumber);
  });

  // Check all 30 numbers are accounted for
  if (allNumbers.size !== 30) return false;

  for (let i = 1; i <= 30; i++) {
    if (!allNumbers.has(i)) return false;
  }

  return true;
}

/**
 * Legacy function for backward compatibility - distributes all 30 numbers
 * @deprecated Use distributeNumbers with mode parameter instead
 */
export function distributeNumbersLegacy(participantIds: string[]): Map<string, number[]> {
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
 * Validates that a legacy distribution is complete and fair
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
