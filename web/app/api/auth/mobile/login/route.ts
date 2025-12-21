import { validateCredentials } from '@/lib/auth'
import { SignJWT } from 'jose'

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json()

        // Use shared validation logic
        const user = await validateCredentials(email, password)

        if (!user) {
            return Response.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            )
        }

        // Generate JWT token for mobile
        // Use the same secret as NextAuth for consistency
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

        const token = await new SignJWT({
            userId: user.id,
            email: user.email
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret)

        // Return token + user data
        return Response.json({
            token,
            user
        })

    } catch (error) {
        console.error('Mobile login error:', error)
        return Response.json(
            { error: 'Something went wrong' },
            { status: 500 }
        )
    }
}
