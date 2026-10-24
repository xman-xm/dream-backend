import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getCurrentUser } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import { GoogleVeo31LiteProvider } from "@/lib/services/veo-provider";

async function ensureVideoPost(job: {
  id: string;
  userId: string;
  prompt: string;
  videoAsset: { storageUrl: string };
}) {
  const mediaUrl = `/api/storage/generated-${job.id}.mp4`;
  const existingPost = await prisma.post.findFirst({
    where: { authorId: job.userId, media: mediaUrl },
  });
  if (existingPost) return existingPost;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_VEO_API_KEY;
  if (!apiKey) throw new Error("Video provider is not configured");

  const upstream = await fetch(job.videoAsset.storageUrl, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!upstream.ok) {
    throw new Error(`Unable to download generated video (${upstream.status})`);
  }

  const storageDir = join(process.cwd(), "storage");
  await mkdir(storageDir, { recursive: true });
  const videoBuffer = Buffer.from(await upstream.arrayBuffer());
  await writeFile(join(storageDir, `generated-${job.id}.mp4`), videoBuffer);

  const post = await prisma.post.create({
    data: {
      authorId: job.userId,
      caption: job.prompt,
      media: mediaUrl,
      type: "VIDEO",
      aiDescription: null,
      videoEngineUsed: "veo-3.1-lite",
    },
    include: { author: true },
  });

  const followers = await prisma.follow.findMany({
    where: { followingId: job.userId },
    select: { followerId: true },
  });
  if (followers.length) {
    const { createNotifications } = await import("@/lib/notification-service");
    try {
      await createNotifications(followers.map(({ followerId }) => ({
        recipientId: followerId,
        actorId: job.userId,
        type: "NEW_POST" as const,
        message: "posted a new video.",
        postId: post.id,
      })));
    } catch (notificationError) {
      console.error("Unable to save generated-video notifications:", notificationError);
    }
  }

  return post;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { jobId } = await params;

    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: {
        attempts: { orderBy: { createdAt: "desc" }, take: 1 },
        videoAsset: true,
      },
    });

    if (!job || job.userId !== userId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const playbackToken = await new SignJWT({ userId, jobId: job.id, type: "video-playback" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET));
    const playbackUrl = new URL(`/api/video/asset/${job.id}`, req.url);
    playbackUrl.searchParams.set("token", playbackToken);

    // If job is completed or already failed, return immediately
    if (job.status === "COMPLETED" || job.status === "FAILED") {
      const post = job.status === "COMPLETED" && job.videoAsset
        ? await ensureVideoPost({ ...job, videoAsset: job.videoAsset })
        : null;
      return NextResponse.json({
        jobId: job.id,
        status: job.status,
        videoAsset: job.videoAsset
          ? { ...job.videoAsset, storageUrl: playbackUrl.toString() }
          : null,
        post,
        errorMessage: job.errorMessage,
      });
    }

    // Check operation status with Veo provider
    const latestAttempt = job.attempts[0];
    if (latestAttempt && latestAttempt.veoOperationId) {
      const provider = new GoogleVeo31LiteProvider();
      const statusResult = await provider.checkStatus(latestAttempt.veoOperationId);

      if (statusResult.status === "COMPLETED" && statusResult.videoUrl) {
        // Create VideoAsset
        const videoAsset = await prisma.videoAsset.create({
          data: {
            generationJobId: job.id,
            storageUrl: statusResult.videoUrl,
            durationSeconds: job.durationSeconds,
            resolution: job.resolution,
            aspectRatio: job.aspectRatio,
          },
        });

        // Update Job Status
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            actualProviderCostUSD: statusResult.estimatedCostUSD,
          },
        });

        const post = await ensureVideoPost({
          id: job.id,
          userId: job.userId,
          prompt: job.prompt,
          videoAsset,
        });

        return NextResponse.json({
          jobId: job.id,
          status: "COMPLETED",
          videoAsset: { ...videoAsset, storageUrl: playbackUrl.toString() },
          post,
        });
      } else if (statusResult.status === "FAILED") {
        // Update Job Status
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: statusResult.errorMessage || "Veo model execution failed",
          },
        });

        return NextResponse.json({
          jobId: job.id,
          status: "FAILED",
          errorMessage: statusResult.errorMessage,
        });
      }
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  } catch (err: unknown) {
    console.error("[API Job Status Error]:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
