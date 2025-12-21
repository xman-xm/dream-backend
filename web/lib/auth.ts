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

    // 5. Return user data (without password!)
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl
    }
}
