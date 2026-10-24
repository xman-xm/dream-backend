import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-unified";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 12), 1), 30);
    const existingFollows = await prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } });
    const excluded = [user.id, ...existingFollows.map(({ followingId }) => followingId)];
    const users = await prisma.user.findMany({
      where: { id: { notIn: excluded } },
      select: { id: true, username: true, name: true, avatarUrl: true, bio: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ suggestions: users });
  } catch (error) {
    console.error("Follow suggestions error:", error);
    return NextResponse.json({ error: "Could not load suggestions" }, { status: 500 });
  }
}
