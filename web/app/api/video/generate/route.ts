import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import { calculateGenerationCost } from "@/lib/services/credit-ledger";
import { GoogleVeo31LiteProvider } from "@/lib/services/veo-provider";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { prompt } = await req.json();

    const durationSeconds = 8;
    const resolution = "720p";
    const aspectRatio = "9:16";

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Calculate Estimated Cost metadata for tracking
    const { providerCostUSD } = calculateGenerationCost(durationSeconds, resolution);

    // Create Generation Job Record (QUEUED) without requiring credits
    const job = await prisma.generationJob.create({
      data: {
        userId,
        prompt: prompt.trim(),
        durationSeconds,
        resolution,
        aspectRatio,
        creditsReserved: 0,
        estimatedProviderCostUSD: providerCostUSD,
        status: "QUEUED",
      },
    });

    // 5. Submit to Provider (Google Veo 3.1 Lite)
    const provider = new GoogleVeo31LiteProvider();
    const result = await provider.generate({
      prompt,
      durationSeconds,
      resolution,
      aspectRatio,
    });

    if (result.status === "FAILED") {
      // Immediate job failure update
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: result.errorMessage || "Failed to submit to Veo API",
        },
      });

      return NextResponse.json(
        { error: result.errorMessage || "Generation initiation failed" },
        { status: 500 }
      );
    }

    // 6. Update Job Status to GENERATING & Log Attempt
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "GENERATING",
      },
    });

    await prisma.generationAttempt.create({
      data: {
        generationJobId: job.id,
        attemptNumber: 1,
        veoOperationId: result.operationId,
        rawProviderStatus: result.status,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "GENERATING",
      creditsReserved: 0,
      estimatedProviderCostUSD: providerCostUSD,
    });
  } catch (err: unknown) {
    console.error("[API Generate Video Error]:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
