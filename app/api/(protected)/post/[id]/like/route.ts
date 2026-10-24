import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

// Toggle like on a post
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params

        // Check if already liked
        const existingLike = await prisma.like.findUnique({
            where: {
                postId_userId: {
                    postId: id,
                    userId: user.id
                }
            }
        })

        if (existingLike) {
            // Unlike
            await prisma.like.delete({
                where: { id: existingLike.id }
            })
            return NextResponse.json({ liked: false })
        } else {
            // Like
            await prisma.like.create({
                data: {
                    postId: id,
                    userId: user.id
                }
            })

            const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
            if (post && post.authorId !== user.id) {
                try {
                    const { createNotifications } = await import("@/lib/notification-service");
                    await createNotifications([{
                        recipientId: post.authorId,
                        actorId: user.id,
                        type: "LIKE",
                        message: "liked your post.",
                        postId: id,
                    }]);
                } catch (notificationError) {
                    console.error("Unable to save like notification:", notificationError);
                }
            }

            // Implicit Learning (Background)
            // Weight 0.05 for a Like
            import("@/lib/learning").then(mod => {
                mod.updateUserInterest(user.id, id, 0.05);
            });

            return NextResponse.json({ liked: true })
        }
    } catch (error) {
        console.error('Error toggling like:', error)
        return NextResponse.json({ error: 'Error toggling like' }, { status: 500 })
    }
}
