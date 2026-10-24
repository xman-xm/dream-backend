import { prisma } from "@/lib/prisma";

export const VEO_RATES = {
  "720p": 0.05,  // USD per second
  "1080p": 0.08, // USD per second
};

// 1 Credit = $0.10 value
export const CREDIT_VALUE_USD = 0.10;

/**
 * Calculates provider raw cost and required platform credits for a given video generation request
 */
export function calculateGenerationCost(durationSeconds: number, resolution: "720p" | "1080p") {
  const ratePerSec = VEO_RATES[resolution] || VEO_RATES["720p"];
  const providerCostUSD = durationSeconds * ratePerSec;
  
  // Apply a 1.5x margin factor to cover infrastructure, storage, payment processing, and operating profit
  const totalCostUSD = providerCostUSD * 1.5;
  const creditsRequired = Math.ceil(totalCostUSD / CREDIT_VALUE_USD);

  return {
    providerCostUSD,
    totalCostUSD,
    creditsRequired,
  };
}

/**
 * Queries the immutable credit ledger to compute a user's current valid balance
 */
export async function getUserCreditBalance(userId: string): Promise<number> {
  const result = await prisma.creditBalanceLedger.aggregate({
    where: { userId },
    _sum: { amount: true },
  });

  return result._sum.amount || 0;
}

/**
 * Grants credits to a user (e.g. following a verified Stripe webhook payment)
 */
export async function addCreditsToUser(
  userId: string,
  amount: number,
  type: "PURCHASE" | "BONUS" | "REFUND",
  referenceId?: string,
  description?: string
) {
  if (amount <= 0) throw new Error("Amount must be positive for adding credits");

  return await prisma.creditBalanceLedger.create({
    data: {
      userId,
      amount,
      type,
      referenceId,
      description: description || `Added ${amount} credits via ${type}`,
    },
  });
}

/**
 * Reserves credits when a user submits a video generation job.
 * Creates a negative ledger entry of type 'RESERVE'.
 */
export async function reserveCreditsForJob(
  userId: string,
  jobId: string,
  creditsCount: number
) {
  const currentBalance = await getUserCreditBalance(userId);
  if (currentBalance < creditsCount) {
    throw new Error(`Insufficient credits. Required: ${creditsCount}, Available: ${currentBalance}`);
  }

  return await prisma.creditBalanceLedger.create({
    data: {
      userId,
      amount: -creditsCount,
      type: "RESERVE",
      referenceId: jobId,
      description: `Reserved ${creditsCount} credits for video generation job ${jobId}`,
    },
  });
}

/**
 * Finalizes credit deduction upon successful video completion.
 * Replaces the 'RESERVE' record with a permanent 'DEDUCT' entry.
 */
export async function finalizeCreditDeduction(jobId: string, userId: string, creditsCount: number) {
  return await prisma.$transaction([
    // Delete/Clear reservation entry
    prisma.creditBalanceLedger.deleteMany({
      where: {
        userId,
        referenceId: jobId,
        type: "RESERVE",
      },
    }),
    // Insert permanent deduction
    prisma.creditBalanceLedger.create({
      data: {
        userId,
        amount: -creditsCount,
        type: "DEDUCT",
        referenceId: jobId,
        description: `Deducted ${creditsCount} credits for completed video generation job ${jobId}`,
      },
    }),
  ]);
}

/**
 * Refunds reserved credits if a generation fails or times out.
 */
export async function refundCreditsForJob(jobId: string, userId: string, creditsCount: number, reason?: string) {
  return await prisma.$transaction([
    // Remove reservation
    prisma.creditBalanceLedger.deleteMany({
      where: {
        userId,
        referenceId: jobId,
        type: "RESERVE",
      },
    }),
    // Add explicit refund ledger entry
    prisma.creditBalanceLedger.create({
      data: {
        userId,
        amount: creditsCount,
        type: "REFUND",
        referenceId: jobId,
        description: reason || `Refunded ${creditsCount} credits due to generation failure for job ${jobId}`,
      },
    }),
  ]);
}
