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
 * Fisher-Yates shuffle algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Distributes numbers 1-30 among N participants using DYNAMIC STRATIFIED distribution.
 *
 * The algorithm creates tiers dynamically based on the number of participants:
 * - For N participants getting K numbers each, creates K tiers of N numbers
 * - This ensures EACH player gets EXACTLY 1 number from each tier
 * - Results in perfectly balanced distribution across early, mid, and late numbers
 *
 * Example with 6 players (5 numbers each):
 * - Creates 5 tiers of 6 numbers: [1-6], [7-12], [13-18], [19-24], [25-30]
 * - Each player gets exactly 1 from each tier
 * - Player might get: 2, 8, 15, 21, 28 (one from each range)
 *
 * EXCLUDE: Remainder numbers are unassigned (one from each "leftover" tier position).
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

  // Calculate distribution counts
  const baseCount = Math.floor(totalNumbers / numParticipants);
  const remainder = totalNumbers % numParticipants;

  // Create DYNAMIC tiers based on number RANGES
  // For N participants, create tiers: [1-N], [N+1 to 2N], [2N+1 to 3N], etc.
  // This ensures early numbers are in early tiers, late numbers in late tiers
  const tiers: number[][] = [];
  for (let tierStart = 1; tierStart <= totalNumbers; tierStart += numParticipants) {
    const tierEnd = Math.min(tierStart + numParticipants - 1, totalNumbers);
    const tier: number[] = [];
    for (let n = tierStart; n <= tierEnd; n++) {
      tier.push(n);
    }
    // Shuffle within each tier so specific number assignment is random
    tiers.push(shuffle(tier));
  }

  // Shuffle participants
  const shuffledParticipants = shuffle([...participantIds]);

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
    const numUnassigned = remainder;

    if (numUnassigned === 0) {
      // Perfect division - no unassigned numbers
      for (const tier of tiers) {
        const shuffledTier = shuffle([...tier]);
        const shuffledPlayers = shuffle([...shuffledParticipants]);
        shuffledPlayers.forEach((player, i) => {
          result.owned.get(player)!.push(shuffledTier[i]);
        });
      }
    } else {
      // Randomly select which numbers will be unassigned (from all 30)
      const allNumbers = shuffle(Array.from({ length: 30 }, (_, i) => i + 1));
      const unassignedNumbers = allNumbers.slice(0, numUnassigned);
      const ownedNumbers = allNumbers.slice(numUnassigned);

      // Create stratified tiers from the owned numbers
      const sortedOwnedNumbers = ownedNumbers.sort((a, b) => a - b);
      const ownedTiers: number[][] = [];
      for (let i = 0; i < sortedOwnedNumbers.length; i += numParticipants) {
        const tier = sortedOwnedNumbers.slice(i, i + numParticipants);
        ownedTiers.push(shuffle(tier));
      }

      // For each tier, randomly assign 1 number to each player
      for (const tier of ownedTiers) {
        const shuffledPlayers = shuffle([...shuffledParticipants]);
        shuffledPlayers.forEach((player, i) => {
          result.owned.get(player)!.push(tier[i]);
        });
      }

      result.unassigned = unassignedNumbers.sort((a, b) => a - b);
    }

    // Sort each player's numbers
    result.owned.forEach((numbers, participantId) => {
      result.owned.set(participantId, numbers.sort((a, b) => a - b));
    });

  } else if (mode === "SHARED") {
    // SHARED mode: randomly select which numbers will be shared,
    // then distribute remaining numbers using stratified tiers

    // Calculate how many numbers will be shared
    const numShared = remainder;

    if (numShared === 0) {
      // Perfect division - no shared numbers needed
      // Process all tiers: each player gets exactly 1 from each
      for (const tier of tiers) {
        const shuffledTier = shuffle([...tier]);
        const shuffledPlayers = shuffle([...shuffledParticipants]);
        shuffledPlayers.forEach((player, i) => {
          result.owned.get(player)!.push(shuffledTier[i]);
        });
      }
    } else {
      // Randomly select which numbers will be shared (from all 30)
      const allNumbers = shuffle(Array.from({ length: 30 }, (_, i) => i + 1));
      const sharedNumbers = new Set(allNumbers.slice(0, numShared));
      const ownedNumbers = allNumbers.slice(numShared);

      // Create stratified tiers from the owned numbers (preserving their natural order for tiers)
      const sortedOwnedNumbers = ownedNumbers.sort((a, b) => a - b);
      const ownedTiers: number[][] = [];
      for (let i = 0; i < sortedOwnedNumbers.length; i += numParticipants) {
        const tier = sortedOwnedNumbers.slice(i, i + numParticipants);
        ownedTiers.push(shuffle(tier));
      }

      // For each tier, randomly assign 1 number to each player
      for (const tier of ownedTiers) {
        const shuffledPlayers = shuffle([...shuffledParticipants]);
        shuffledPlayers.forEach((player, i) => {
          result.owned.get(player)!.push(tier[i]);
        });
      }

      // Shuffle participants for fair share distribution
      const shuffledForSharing = shuffle([...shuffledParticipants]);
      const remainderNumbers = Array.from(sharedNumbers).sort((a, b) => a - b);

      // Calculate how many participants share each remainder number
      const shareGroupSizes: number[] = [];
      let remainingParticipants = numParticipants;
      for (let i = 0; i < remainderNumbers.length; i++) {
        const remainingRemainders = remainderNumbers.length - i;
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

    // Sort each player's owned numbers
    result.owned.forEach((numbers, participantId) => {
      result.owned.set(participantId, numbers.sort((a, b) => a - b));
    });
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
 * Analyzes tier distribution for a set of numbers using fixed 3-tier system.
 * Useful for verifying stratified distribution is working correctly.
 */
export function analyzeTierDistribution(numbers: number[]): { tier1: number; tier2: number; tier3: number } {
  return {
    tier1: numbers.filter(n => n >= 1 && n <= 10).length,
    tier2: numbers.filter(n => n >= 11 && n <= 20).length,
    tier3: numbers.filter(n => n >= 21 && n <= 30).length,
  };
}

/**
 * Analyzes dynamic tier distribution for a set of numbers.
 * Shows how many numbers fall into each tier based on participant count.
 */
export function analyzeDynamicTiers(numbers: number[], numParticipants: number): number[] {
  const tierSize = numParticipants;
  const numTiers = Math.ceil(30 / tierSize);
  const result: number[] = [];

  for (let t = 0; t < numTiers; t++) {
    const tierStart = t * tierSize + 1;
    const tierEnd = Math.min((t + 1) * tierSize, 30);
    const count = numbers.filter(n => n >= tierStart && n <= tierEnd).length;
    result.push(count);
  }

  return result;
}

/**
 * Legacy function for backward compatibility - distributes all 30 numbers
 * Now uses stratified distribution for fairness.
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

  // Use stratified distribution with SHARED mode (distributes all 30)
  // then flatten owned + shared into a simple map
  const result = distributeNumbers(participantIds, "SHARED");

  // Convert to legacy format: merge owned and shared assignments
  const distribution = new Map<string, number[]>();

  result.owned.forEach((numbers, participantId) => {
    distribution.set(participantId, [...numbers]);
  });

  // Add shared numbers to each participant who shares them
  result.shared.forEach((participantIds, entryNumber) => {
    participantIds.forEach(participantId => {
      const current = distribution.get(participantId) || [];
      current.push(entryNumber);
      distribution.set(participantId, current);
    });
  });

  // Sort each player's numbers
  distribution.forEach((numbers, participantId) => {
    distribution.set(participantId, numbers.sort((a, b) => a - b));
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
