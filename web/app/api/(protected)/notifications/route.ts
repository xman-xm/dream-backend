import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-unified";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 30), 1), 50);
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: user.id },
        include: {
          actor: { select: { id: true, username: true, name: true, avatarUrl: true } },
          post: { select: { id: true, media: true, type: true, caption: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
      prisma.notification.count({ where: { recipientId: user.id, readAt: null } }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
      nextCursor: notifications.length === limit ? notifications[notifications.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ error: "Could not load notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    if (body.markAllRead === true) {
      await prisma.notification.updateMany({
        where: { recipientId: user.id, readAt: null },
        data: { readAt: now },
      });
      return NextResponse.json({ success: true });
    }

    if (typeof body.notificationId !== "string") {
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    }
    const result = await prisma.notification.updateMany({
      where: { id: body.notificationId, recipientId: user.id, readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json({ error: "Could not update notification" }, { status: 500 });
  }
}
