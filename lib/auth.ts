import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * Validates user credentials (email + password)
 * Returns user object if valid, null if invalid
 * Used by BOTH NextAuth (web) and mobile API endpoints
 */
export async function validateCredentials(
    email: string | undefined | null,
    password: string | undefined | null
) {
    // 1. Check if email/password exist
    if (!email || !password) {
        return null
    }

    // 2. Find user in database
    const user = await prisma.user.findUnique({
        where: { email }
    })

    // 3. Check if user exists and has password
    if (!user || !user.password) {
        return null
    }

    // 4. Compare password with hash
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
        return null
    }

    const [followersCount, followingCount, postsCount] = await Promise.all([
        prisma.follow.count({ where: { followingId: user.id } }),
        prisma.follow.count({ where: { followerId: user.id } }),
        prisma.post.count({ where: { authorId: user.id } }),
    ]);

    // 6. Return user data (without password!)
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        _count: {
            followers: followersCount,
            following: followingCount,
            posts: postsCount,
        }
    }
}
