import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getCurrentUser } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const user = await getCurrentUser(req);
    let userId = user?.id;

    if (!userId) {
      const token = new URL(req.url).searchParams.get("token");
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      try {
        const { payload } = await jwtVerify(
          token,
          new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
        );
        if (payload.type !== "video-playback" || payload.jobId !== jobId) {
          return NextResponse.json({ error: "Invalid video token" }, { status: 401 });
        }
        userId = payload.userId as string;
      } catch {
        return NextResponse.json({ error: "Invalid or expired video token" }, { status: 401 });
      }
    }

    const asset = await prisma.videoAsset.findUnique({
      where: { generationJobId: jobId },
      include: { generationJob: { select: { userId: true } } },
    });

    if (!asset || asset.generationJob.userId !== userId) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_VEO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Video provider is not configured" }, { status: 503 });
    }

    const headers = new Headers({ "x-goog-api-key": apiKey });
    const range = req.headers.get("range");
    if (range) headers.set("range", range);

    let upstream = await fetch(asset.storageUrl, { headers });
    const contentType = upstream.headers.get("content-type") || "";

    // Gemini may return a Files API resource URI first; request its binary form.
    if (upstream.ok && contentType.includes("application/json") && asset.storageUrl.includes("/files/")) {
      const downloadUrl = `${asset.storageUrl.replace(/\/$/, "")}:download?alt=media`;
      upstream = await fetch(downloadUrl, { headers });
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Video provider returned ${upstream.status}` },
        { status: upstream.status || 502 }
      );
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");
    responseHeaders.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    for (const name of ["content-length", "content-range"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    console.error("[API Video Asset Error]:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
