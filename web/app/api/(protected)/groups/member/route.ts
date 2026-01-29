import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const memberships = await prisma.groupMember.findMany({
            where: {
                userId: user.id
            },
            include: {
                group: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        _count: {
                            select: { members: true }
                        }
                    }
                }
            },
            orderBy: {
                joinedAt: 'desc'
            }
        })

        const groups = memberships.map(m => ({
            ...m.group,
            memberCount: m.group._count.members
        }))

        return NextResponse.json(groups)
    } catch (error) {
        console.error("Error fetching user groups:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
