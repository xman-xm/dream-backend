import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

// Get comments for a post
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const comments = await prisma.comment.findMany({
            where: { postId: id },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(comments)
    } catch (error) {
        console.error('Error fetching comments:', error)
        return NextResponse.json({ error: 'Error fetching comments' }, { status: 500 })
    }
}

// Add a comment to a post
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
        const { content } = await request.json()

        if (!content || content.trim().length === 0) {
            return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
        }

        const comment = await prisma.comment.create({
            data: {
                content: content.trim(),
                postId: id,
                authorId: user.id
            },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            }
        })

        const postOwner = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
        if (postOwner && postOwner.authorId !== user.id) {
            try {
                const { createNotifications } = await import("@/lib/notification-service");
                await createNotifications([{
                    recipientId: postOwner.authorId,
                    actorId: user.id,
                    type: "COMMENT",
                    message: `commented: ${content.trim().slice(0, 90)}`,
                    postId: id,
                }]);
            } catch (notificationError) {
                console.error("Unable to save comment notification:", notificationError);
            }
        }

        // Implicit Learning (Background)
        // Weight 0.10 for a Comment
        import("@/lib/learning").then(mod => {
            mod.updateUserInterest(user.id, id, 0.10);
        });

        return NextResponse.json(comment)
    } catch (error) {
        console.error('Error creating comment:', error)
        return NextResponse.json({ error: 'Error creating comment' }, { status: 500 })
    }
}
