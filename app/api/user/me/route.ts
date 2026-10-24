import { getCurrentUser } from "@/lib/auth-unified"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    const user = await getCurrentUser(req)

    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [followersCount, followingCount, postsCount] = await Promise.all([
        prisma.follow.count({ where: { followingId: user.id } }),
        prisma.follow.count({ where: { followerId: user.id } }),
        prisma.post.count({ where: { authorId: user.id } }),
    ]);

    return Response.json({
        user: { ...user, _count: { posts: postsCount, followers: followersCount, following: followingCount } }
    })
}
