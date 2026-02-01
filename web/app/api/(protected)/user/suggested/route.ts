import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth-unified"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const userResult = await prisma.$queryRaw`
            SELECT "interestEmbedding" FROM "User" WHERE id = ${user.id}
        ` as any[]
        const userRecord = userResult[0] || null

        const hasInterest = !!(userRecord as any)?.interestEmbedding

        // Logic:
        // 1. Exclude myself.
        // 2. Exclude existing friends (request sent or accepted).

        // We can do this efficiently in SQL or fetch friend IDs first.
        // Fetching friend IDs is cleaner for Prisma Raw.

        const existingConnections = await prisma.friendship.findMany({
            where: {
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

        const excludedIds = new Set<string>()
        excludedIds.add(user.id)
        existingConnections.forEach(c => {
            excludedIds.add(c.requesterId)
            excludedIds.add(c.addresseeId)
        })

        const excludedIdsArray = Array.from(excludedIds)

        // Raw Query for Suggestions
        // For exclusions in raw query with array, it's tricky.
        // Easier to filter common users or use specific syntax.
        // Or simpler: Get top 50 matches, then filter in JS.
        // But for vector search, we want the database to sort.

        // We can pass excluded IDs if the list is small. If large, this scales poorly.
        // For MVP, we assume < 500 friends, so passing array is OK-ish, or use EXISTS logic.

        // Let's rely on popularity if no vector, or vector similarity if present.
        // And we'll LIMIT 20 to be safe.

        const suggestedUsers = await prisma.$queryRaw`
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u."avatarUrl",
                ${hasInterest
                ? Prisma.sql`(1 - (u."interestEmbedding" <=> ${(userRecord as any).interestEmbedding}))`
                : Prisma.sql`0.5`} as match_score
            FROM "User" u
            WHERE u.id NOT IN (${Prisma.join(excludedIdsArray)})
            ORDER BY 
                 ${hasInterest
                ? Prisma.sql`(1 - (u."interestEmbedding" <=> ${(userRecord as any).interestEmbedding}))`
                : Prisma.sql`u."createdAt"`} DESC
            LIMIT 20
        ` as any[]

        // Formatter
        const formatted = suggestedUsers.map((u: any) => ({
            id: u.id,
            name: u.name,
            username: u.username,
            avatarUrl: u.avatarUrl,
            matchScore: u.match_score
        }))

        return NextResponse.json(formatted)

    } catch (error) {
        console.error("Error fetching suggestions:", error)
        return NextResponse.json({ error: 'Error fetching suggestions' }, { status: 500 })
    }
}
