import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"
import { writeFile } from "fs/promises"
import { join } from "path"
import { sendPushNotification } from "@/lib/notifications"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 1. Get User's Friend IDs
        const memberships = await prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [
                    { requesterId: user.id },
                    { addresseeId: user.id }
                ]
            },
            select: {
                requesterId: true,
                addresseeId: true
            }
        })

        const friendIds = new Set<string>()
        memberships.forEach(f => {
            friendIds.add(f.requesterId === user.id ? f.addresseeId : f.requesterId)
        })

        let whereCondition: any = {}

        // 2. Feed Algorithm
        if (friendIds.size > 0) {
            // "Friends Feed": Show ONLY my friends' posts (User requested to exclude self)
            whereCondition = {
                authorId: {
                    in: Array.from(friendIds)
                }
            }
        } else {
            // "Global Cold Start": User has no friends, show everything EXCEPT my own posts
            whereCondition = {
                authorId: {
                    not: user.id
                }
            }
        }

        const posts = await prisma.post.findMany({
            where: whereCondition,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                author: true,
                likes: {
                    where: { userId: user.id } // optimal way to see if I liked it
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true
                    }
                }
            },
            take: 50
        })

        // Enhance post object with 'isLiked'
        const enhancedPosts = posts.map(post => ({
            ...post,
            isLiked: post.likes.length > 0
        }))

        return NextResponse.json(enhancedPosts)
    } catch (error) {
        console.error("Feed error:", error)
        return NextResponse.json({ error: 'Error fetching feed' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const caption = formData.get('caption') as string
        const authorId = formData.get('authorId') as string
        const groupId = formData.get('groupId') as string | null
        const file = formData.get('image') as File | null

        if (!authorId) {
            return NextResponse.json({ error: 'Author ID is required' }, { status: 400 })
        }

        let mediaUrl = ''
        let mediaType = 'IMAGE'

        if (file) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)

            // Ensure unique filename
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
            const filename = `${uniqueSuffix}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`

            // Save to secure storage (not public)
            const uploadDir = join(process.cwd(), 'storage')
            const filepath = join(uploadDir, filename)

            await writeFile(filepath, buffer)

            // Set secure API URL
            mediaUrl = `/api/storage/${filename}`

            // Simple type detection
            if (file.type.startsWith('video/')) {
                mediaType = 'VIDEO'
            }
        }

        const post = await prisma.post.create({
            data: {
                caption: caption || '',
                authorId,
                groupId,
                media: mediaUrl,
                type: mediaType
            },
            include: {
                author: true
            }
        })

        // Notify Friends
        const friends = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: user.id },
                    { addresseeId: user.id }
                ],
                status: 'ACCEPTED'
            },
            include: {
                requester: { select: { id: true, pushToken: true } },
                addressee: { select: { id: true, pushToken: true } }
            }
        })


        // Get current user's push token to avoid self-notifications (e.g. same device testing)
        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { pushToken: true }
        })

        const tokens: string[] = []
        friends.forEach(f => {
            const friend = f.requesterId === user.id ? f.addressee : f.requester
            if (friend.pushToken && friend.pushToken !== currentUser?.pushToken) {
                tokens.push(friend.pushToken)
            }
        })

        console.log(`[DEBUG] Found ${friends.length} friends for user ${user.id}`);
        console.log(`[DEBUG] Sending notifications to ${tokens.length} tokens`);

        if (tokens.length > 0) {
            await sendPushNotification(
                tokens,
                `New Post from ${user.name || user.username}`,
                `Check out what ${user.name || user.username} just posted!`,
                { postId: post.id }
            )
        }

        return NextResponse.json(post)
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Error creating post' }, { status: 500 })
    }
}
