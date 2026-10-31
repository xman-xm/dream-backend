import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-unified";
import { createNotifications } from "@/lib/notification-service";

type FollowListUser = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

type FollowingEntry = {
  createdAt: Date;
  following: FollowListUser;
};

type FollowerEntry = {
  createdAt: Date;
  follower: FollowListUser;
};

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || user.id;
    const [following, followers] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { select: { id: true, username: true, name: true, avatarUrl: true, bio: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.follow.findMany({
        where: { followingId: userId },
        include: { follower: { select: { id: true, username: true, name: true, avatarUrl: true, bio: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return NextResponse.json({
      following: following.map((follow: FollowingEntry) => ({ ...follow.following, followedAt: follow.createdAt })),
      followers: followers.map((follow: FollowerEntry) => ({ ...follow.follower, followedAt: follow.createdAt })),
    });
  } catch (error) {
    console.error("Follow list error:", error);
    return NextResponse.json({ error: "Could not load follow list" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, username: true, name: true } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const key = { followerId_followingId: { followerId: user.id, followingId: targetUserId } };
    const existing = await prisma.follow.findUnique({ where: key, select: { id: true } });
    const follow = existing || await prisma.follow.create({ data: key.followerId_followingId });

    if (!existing) {
      try {
        await createNotifications([{
          recipientId: targetUserId,
          actorId: user.id,
          type: "FOLLOW",
          message: "started following you.",
        }]);
      } catch (error) {
        console.error("Unable to save follow notification:", error);
      }
    }

    return NextResponse.json({ following: true, followId: follow.id });
  } catch (error) {
    console.error("Follow error:", error);
    return NextResponse.json({ error: "Could not follow user" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const followingId = searchParams.get("followingId");
    if (!followingId || followingId === user.id) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    await prisma.follow.deleteMany({ where: { followerId: user.id, followingId } });
    return NextResponse.json({ following: false });
  } catch (error) {
    console.error("Unfollow error:", error);
    return NextResponse.json({ error: "Could not unfollow user" }, { status: 500 });
  }
}
