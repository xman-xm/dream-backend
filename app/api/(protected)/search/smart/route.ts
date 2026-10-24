import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-unified";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (!query) return NextResponse.json({ users: [], posts: [] });

  try {
    const [users, posts] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { not: user.id },
          OR: [
            { username: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, username: true, name: true, avatarUrl: true },
        orderBy: { username: "asc" },
        take: 20,
      }),
      prisma.post.findMany({
        where: {
          OR: [
            { caption: { contains: query, mode: "insensitive" } },
            { aiDescription: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          author: { select: { id: true, username: true, name: true, avatarUrl: true } },
          likes: { where: { userId: user.id }, select: { id: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const follows = users.length
      ? await prisma.follow.findMany({
          where: { followerId: user.id, followingId: { in: users.map(({ id }) => id) } },
          select: { followingId: true },
        })
      : [];
    const followingIds = new Set(follows.map(({ followingId }) => followingId));

    return NextResponse.json({
      users: users.map((result) => ({ ...result, isFollowing: followingIds.has(result.id) })),
      posts: posts.map(({ likes, ...post }) => ({ ...post, isLiked: likes.length > 0 })),
    });
  } catch (error) {
    console.error("Smart search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
