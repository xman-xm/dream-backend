import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function POST(
    request: Request,
    props: { params: Promise<{ id: string; userId: string }> }
) {
    const params = await props.params;
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: groupId, userId: targetUserId } = params

    try {
        const { action } = await request.json() // action: 'ACCEPT' | 'DECLINE'

        if (!['ACCEPT', 'DECLINE'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        // Check if requester is admin
        const adminMembership = await prisma.groupMember.findUnique({
            where: {
                groupId_userId: {
                    groupId,
                    userId: user.id
                }
            }
        })

        if (!adminMembership || adminMembership.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (action === 'ACCEPT') {
            const updated = await prisma.groupMember.update({
                where: {
                    groupId_userId: {
                        groupId,
                        userId: targetUserId
                    }
                },
                data: {
                    status: 'ACCEPTED'
                }
            })
            return NextResponse.json(updated)
        } else {
            // DECLINE - Remove the membership record or set to DECLINE?
            // As per schema, we have DECLINED status, so let's use it.
            const updated = await prisma.groupMember.update({
                where: {
                    groupId_userId: {
                        groupId,
                        userId: targetUserId
                    }
                },
                data: {
                    status: 'DECLINED'
                }
            })
            return NextResponse.json(updated)
        }

    } catch (error) {
        console.error("Error managing group request:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
