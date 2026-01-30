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

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findUnique({
        where: {
            groupId_userId: {
                groupId,
                userId: user.id
            }
        }
    })

    if (!membership || membership.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const requests = await prisma.groupMember.findMany({
            where: {
                groupId,
                status: 'PENDING'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            }
        })

        return NextResponse.json(requests)
    } catch (error) {
        console.error("Error fetching group requests:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
