import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 1. Get my current friends (IDs)
        const myFriendships = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: user.id, status: 'ACCEPTED' },
                    { addresseeId: user.id, status: 'ACCEPTED' }
                ]
            }
        })

        const myFriendIds = new Set<string>()
        myFriendIds.add(user.id) // Exclude self

        for (const f of myFriendships) {
            myFriendIds.add(f.requesterId === user.id ? f.addresseeId : f.requesterId)
        }

        const myFriendIdsArray = Array.from(myFriendIds)

        // 2. Find Friends of Friends (Candidates)
        // We look for friendships where ONE party is in myFriendIds, and the OTHER is NOT.
        const fofFriendships = await prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [
                    { requesterId: { in: myFriendIdsArray } },
                    { addresseeId: { in: myFriendIdsArray } }
                ]
            },
            take: 200 // Limit to avoid massive processing
        })

        const candidates: Record<string, number> = {}

        for (const f of fofFriendships) {
            let candidateId = null
            if (myFriendIds.has(f.requesterId) && !myFriendIds.has(f.addresseeId)) {
                candidateId = f.addresseeId
            } else if (!myFriendIds.has(f.requesterId) && myFriendIds.has(f.addresseeId)) {
                candidateId = f.requesterId
            }

            if (candidateId) {
                candidates[candidateId] = (candidates[candidateId] || 0) + 1
            }
        }

        // 3. Sort candidates by mutual friend count
        const sortedCandidateIds = Object.keys(candidates).sort((a, b) => candidates[b] - candidates[a])

        let suggestions: { id: string; name: string | null; username: string | null; avatarUrl: string | null; bio: string | null }[] = []

        if (sortedCandidateIds.length > 0) {
            suggestions = await prisma.user.findMany({
                where: { id: { in: sortedCandidateIds.slice(0, 10) } },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatarUrl: true,
                    bio: true
                }
            })
            // Add mutual count to response? For MVP, maybe not needed on UI, but good for debugging.
        }

        // 4. Fallback (Cold Start): If not enough suggestions, fetch random/recent users
        if (suggestions.length < 5) {
            const excludeIds = [...myFriendIdsArray, ...suggestions.map(s => s.id)]

            const randomUsers = await prisma.user.findMany({
                where: {
                    id: { notIn: excludeIds }
                },
                take: 10 - suggestions.length,
                orderBy: { createdAt: 'desc' }, // Simple helpful heuristic: new users might want friends
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatarUrl: true,
                    bio: true
                }
            })

            suggestions = [...suggestions, ...randomUsers]
        }

        return NextResponse.json({ suggestions })

    } catch (error) {
        console.error("Error fetching suggestions:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
