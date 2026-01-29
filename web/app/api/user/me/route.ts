import { getCurrentUser } from "@/lib/auth-unified"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    const user = await getCurrentUser(req)

    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Calculate counts
    const friendsCount = await prisma.friendship.count({
        where: {
            OR: [
                { requesterId: user.id, status: 'ACCEPTED' },
                { addresseeId: user.id, status: 'ACCEPTED' }
            ]
        }
    });

    const postsCount = await prisma.post.count({
        where: { authorId: user.id }
    });

    return Response.json({
        user: { ...user, _count: { posts: postsCount, friends: friendsCount } }
    })
}
