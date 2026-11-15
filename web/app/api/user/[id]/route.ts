import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: targetUserId } = params
    console.log(`[API] Fetching profile for ID: ${targetUserId}`);

    if (!targetUserId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
                bio: true
            }
        })

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const [isFollowing, followersCount, followingCount, postsCount] = await Promise.all([
            currentUser.id === targetUserId
                ? Promise.resolve(false)
                : prisma.follow.findUnique({
                    where: { followerId_followingId: { followerId: currentUser.id, followingId: targetUserId } },
                    select: { id: true },
                }).then(Boolean),
            prisma.follow.count({ where: { followingId: targetUserId } }),
            prisma.follow.count({ where: { followerId: targetUserId } }),
            prisma.post.count({ where: { authorId: targetUserId } }),
        ]);

        return NextResponse.json({
            user: { ...targetUser, _count: { posts: postsCount, followers: followersCount, following: followingCount } },
            isFollowing,
            isSelf: currentUser.id === targetUserId
        })

    } catch (error) {
        console.error("Error fetching user profile:", error)
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 })
    }
}
