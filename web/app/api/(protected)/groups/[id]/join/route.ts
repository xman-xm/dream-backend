import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function POST(
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
        // Check if group exists
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            select: { isPrivate: true, id: true }
        })

        if (!group) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 })
        }

        // Check if already member
        const existing = await prisma.groupMember.findUnique({
            where: {
                groupId_userId: {
                    groupId,
                    userId: user.id
                }
            }
        })

        if (existing) {
            return NextResponse.json({ error: 'Already a member' }, { status: 400 })
        }

        // Join Group
        // Join Group
        const status = group.isPrivate ? 'PENDING' : 'ACCEPTED'

        const membership = await prisma.groupMember.create({
            data: {
                groupId,
                userId: user.id,
                role: 'MEMBER',
                status
            }
        })

        return NextResponse.json(membership)

    } catch (error) {
        console.error("Error joining group:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
