import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: groupId } = params

    if (!groupId) {
        return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    try {
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: {
                _count: {
                    select: { members: true }
                }
            }
        })

        if (!group) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 })
        }

        // Check if user is a member
        const membership = await prisma.groupMember.findUnique({
            where: {
                groupId_userId: {
                    groupId,
                    userId: user.id
                }
            }
        })

        // Fetch posts for this group
        const posts = await prisma.post.findMany({
            where: {
                groupId: groupId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                author: true,
                likes: {
                    where: { userId: user.id }
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

        const enhancedPosts = posts.map(post => ({
            ...post,
            isLiked: post.likes.length > 0
        }))

        return NextResponse.json({
            group: {
                ...group,
                memberCount: group._count.members,
                isMember: !!membership,
                role: membership?.role || null
            },
            posts: enhancedPosts
        })

    } catch (error) {
        console.error("Error fetching group details:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
