import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"
import { sendPushNotification } from "@/lib/notifications"

// GET: List friends and pending requests
export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Fetch all friendship records involves the user
        const friendships = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: user.id },
                    { addresseeId: user.id }
                ]
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatarUrl: true
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatarUrl: true
                    }
                }
            }
        })

        const friends = []
        const incomingRequests = []
        const sentRequests = []
        const declinedRequests = []

        for (const f of friendships) {
            if (f.status === 'ACCEPTED') {
                const friend = f.requesterId === user.id ? f.addressee : f.requester
                friends.push({ ...friend, friendshipId: f.id })
            } else if (f.status === 'PENDING') {
                if (f.addresseeId === user.id) {
                    incomingRequests.push({ ...f.requester, friendshipId: f.id, createdAt: f.createdAt })
                } else {
                    sentRequests.push({ ...f.addressee, friendshipId: f.id, createdAt: f.createdAt })
                }
            } else if (f.status === 'DECLINED') {
                // If I requested and they declined, I want to see it
                if (f.requesterId === user.id) {
                    declinedRequests.push({ ...f.addressee, friendshipId: f.id, createdAt: f.updatedAt })
                }
            }
        }

        return NextResponse.json({
            friends,
            incomingRequests,
            sentRequests,
            declinedRequests
        })
    } catch (error) {
        console.error("Error fetching friends:", error)
        try {
            // Fallback for when schema isn't updated in runtime yet
            return NextResponse.json({ friends: [], incomingRequests: [], sentRequests: [], declinedRequests: [] })
        } catch (e) {
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
        }
    }
}

// POST: Send a friend request
export async function POST(request: Request) {
    const user = await getCurrentUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { targetUserId } = await request.json()

        if (!targetUserId || targetUserId === user.id) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
        }

        // Check if exists
        const existing = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId: user.id, addresseeId: targetUserId },
                    { requesterId: targetUserId, addresseeId: user.id }
                ]
            }
        })

        if (existing) {
            // If it was declined previously, maybe allow re-requesting? 
            // For now, let's say "already exists" and user has to delete the declined record first?
            // Or maybe we update it to PENDING if it was DECLINED?
            if (existing.status === 'DECLINED') {
                const updated = await prisma.friendship.update({
                    where: { id: existing.id },
                    data: {
                        status: 'PENDING',
                        requesterId: user.id, // Ensure I become the requester
                        addresseeId: targetUserId
                    }
                })
                return NextResponse.json(updated)
            }

            return NextResponse.json({ error: 'Friendship or request already exists' }, { status: 409 })
        }

        const friendship = await prisma.friendship.create({
            data: {
                requesterId: user.id,
                addresseeId: targetUserId,
                status: 'PENDING'
            }
        })

        return NextResponse.json(friendship)
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// PATCH: Accept or Decline a friend request
export async function PATCH(request: Request) {
    const user = await getCurrentUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { friendshipId, action } = await request.json()
        // action: 'ACCEPT' | 'DECLINE'

        const friendship = await prisma.friendship.findUnique({
            where: { id: friendshipId }
        })

        if (!friendship) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Only the addressee can accept/decline
        if (friendship.addresseeId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        let statusUpdate: any = 'ACCEPTED';
        if (action === 'DECLINE') {
            statusUpdate = 'DECLINED';
        }

        const updated = await prisma.friendship.update({
            where: { id: friendshipId },
            data: { status: statusUpdate },
            include: {
                requester: { select: { id: true, pushToken: true, name: true, username: true } }
            }
        })

        // Notify the requester about the decision
        if (updated.requester.pushToken) {
            const title = statusUpdate === 'ACCEPTED' ? 'Friend Request Accepted' : 'Friend Request Declined';
            const body = statusUpdate === 'ACCEPTED'
                ? `${user.name || user.username} accepted your friend request!`
                : `${user.name || user.username} declined your friend request.`;

            await sendPushNotification(
                [updated.requester.pushToken],
                title,
                body,
                { type: 'FRIEND_UPDATE' }
            )
        }

        return NextResponse.json(updated)
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// DELETE: Decline request or Remove friend
export async function DELETE(request: Request) {
    const user = await getCurrentUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const { searchParams } = new URL(request.url)
        const friendshipId = searchParams.get('id')

        if (!friendshipId) {
            return NextResponse.json({ error: 'Missing friendship ID' }, { status: 400 })
        }

        const friendship = await prisma.friendship.findUnique({
            where: { id: friendshipId }
        })

        if (!friendship) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Only participants can delete
        if (friendship.requesterId !== user.id && friendship.addresseeId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await prisma.friendship.delete({
            where: { id: friendshipId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
