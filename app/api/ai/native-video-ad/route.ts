import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-unified";
import {
  planNativeAdIntegration,
  publishAdFinancedVideo,
  recordVideoQualifyingView,
  fetchAdProductsFromDB,
  AdvertiserRequirements
} from "@/lib/native-video-ad";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/native-video-ad
 * 
 * Generates an AI-Native Ad-Financed Video using Google Veo 3.1 Lite & Dynamic Placement Engine.
 * Financed via one-time permanent native product placements.
 * Auto-publishes to the social feed with a 1,000-view exposure contract lock.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request).catch(() => null);

    let body: any = {};
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json(
        { error: "Invalid or empty JSON body in request." },
        { status: 400 }
      );
    }

    const {
      userPrompt,
      advertiser,
      videoConfig,
      generationCostUSD = 1.00
    } = body;

    if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
      return NextResponse.json(
        { error: "Field 'userPrompt' is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    const advertiserReq: AdvertiserRequirements | undefined = advertiser
      ? {
          brandName: advertiser.brandName,
          productName: advertiser.productName,
          category: advertiser.category,
          placementType: advertiser.placementType,
        }
      : undefined;

    // Step 1: Run Ad-Integration Planner (LLM) using Dynamic Placement Engine (Veo 3.1 Lite architecture)
    const integrationPlan = await planNativeAdIntegration(
      userPrompt.trim(),
      advertiserReq,
      generationCostUSD
    );

    // Step 2: Publish Ad-Financed Video to Social Feed and record in PostgreSQL DB
    const result = await publishAdFinancedVideo(integrationPlan, user?.id);

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      postId: result.postId,
      status: result.status,
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl,
      adIntegrationPlan: integrationPlan,
      engineUsed: result.engineUsed,
      lifecycle: result.lifecycle,
      meta: {
        architecture: "Veo 3.1 Lite Ad-Financed Social Video Platform",
        modelUsed: "veo-3.1-lite",
        minimumAdvertisersMatched: integrationPlan.minimumAdvertiserCount,
        creativePreservationScore: integrationPlan.creativePreservationScore,
        totalNativeRevenueUSD: integrationPlan.totalNativeRevenueUSD,
        generationCostUSD: integrationPlan.generationCostUSD,
        costOffsetPercentage: `${integrationPlan.costOffsetPercentage}%`,
        minExposureTarget: 1000
      }
    });
  } catch (error: any) {
    console.error("[NativeVideoAd API Error]:", error);
    return NextResponse.json(
      {
        error: "Failed to process native AI video ad generation request.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai/native-video-ad
 * 
 * Simulates / records qualifying views on a sponsored video post.
 * Request body: { postId: "string", viewsToAdd: 500 }
 */
export async function PUT(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid or empty JSON body in request." }, { status: 400 });
    }

    const { postId, viewsToAdd = 250 } = body;

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const updatedPost = await recordVideoQualifyingView(postId, viewsToAdd);

    if (!updatedPost) {
      return NextResponse.json({ error: "Post not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Recorded ${viewsToAdd} qualifying views on post ${postId}`,
      post: {
        id: updatedPost.id,
        viewsCount: updatedPost.viewsCount,
        qualifyingViews: updatedPost.qualifyingViews,
        minExposureTarget: updatedPost.minExposureTarget,
        sponsoredStatus: updatedPost.sponsoredStatus,
        canDelete: updatedPost.canDelete,
        adPlacements: updatedPost.adPlacements
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/ai/native-video-ad
 * 
 * Returns system health, active database sponsored products catalog, and published sponsored video feed.
 */
export async function GET() {
  const activeProductsFromDB = await fetchAdProductsFromDB();
  const recentSponsoredPosts = await prisma.post.findMany({
    where: { isSponsored: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { adPlacements: true }
  });

  return NextResponse.json({
    service: "Veo 3.1 Lite AI Native Video Platform",
    status: "active",
    defaultVideoModel: "veo-3.1-lite",
    description: "Finances AI video generation via permanent 1-time native product placements. 1,000-view exposure contract enforced.",
    activeDatabaseProducts: activeProductsFromDB,
    recentSponsoredPosts,
    economics: {
      defaultGenerationCostUSD: 1.00,
      minimumExposureViewsTarget: 1000,
      modelArchitecture: "Provider-Independent VideoGenerationService (Veo 3.1 Lite primary, Kling 3.0 fallback)"
    }
  });
}
