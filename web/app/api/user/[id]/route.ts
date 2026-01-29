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

        // Determine relationship status
        let status = 'NONE'; // NONE, FRIENDS, SENT_REQUEST, RECEIVED_REQUEST, SELF

        if (currentUser.id === targetUserId) {
            status = 'SELF';
        } else {
            const friendship = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { requesterId: currentUser.id, addresseeId: targetUserId },
                        { requesterId: targetUserId, addresseeId: currentUser.id }
                    ]
                }
            })

            if (friendship) {
                if (friendship.status === 'ACCEPTED') {
                    status = 'FRIENDS';
                } else if (friendship.status === 'PENDING') {
                    if (friendship.requesterId === currentUser.id) {
                        status = 'SENT_REQUEST';
                    } else {
                        status = 'RECEIVED_REQUEST';
                    }
                }
                // IGNORED/DECLINED could be treated as NONE or specific status if needed
            }
        }

        // Optional: Mutual Friends Count
        // To be implemented later if needed for optimization, current plan lists it as optional.

        // Calculate counts
        const friendsCount = await prisma.friendship.count({
            where: {
                OR: [
                    { requesterId: targetUserId, status: 'ACCEPTED' },
                    { addresseeId: targetUserId, status: 'ACCEPTED' }
                ]
            }
        });

        const postsCount = await prisma.post.count({
            where: { authorId: targetUserId }
        });

        return NextResponse.json({
            user: { ...targetUser, _count: { posts: postsCount, friends: friendsCount } },
            status
        })

    } catch (error) {
        console.error("Error fetching user profile:", error)
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 })
    }
}
