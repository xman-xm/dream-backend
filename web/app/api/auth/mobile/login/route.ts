import { validateCredentials } from '@/lib/auth'
import { SignJWT } from 'jose'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function OPTIONS() {
    return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: Request) {
    let email, password;

    try {
        const body = await req.json()
        email = body.email
        password = body.password
    } catch (error) {
        return Response.json(
            { error: 'Invalid JSON body' },
            { status: 400, headers: corsHeaders }
        )
    }

    try {
        // Use shared validation logic
        const user = await validateCredentials(email, password)

        if (!user) {
            return Response.json(
                { error: 'Invalid email or password' },
                { status: 401, headers: corsHeaders }
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
        }, { headers: corsHeaders })

    } catch (error) {
        console.error('Mobile login error:', error)
        return Response.json(
            { error: 'Something went wrong' },
            { status: 500, headers: corsHeaders }
        )
    }
}
