import { jwtVerify, SignJWT } from "jose"

export async function POST(req: Request) {
    try {
        // ideally, you'd send a specific refresh token, but for simplicity
        // we'll accept a still-valid or slightly-expired access token if you pass it in the body.
        // OR standard practice: require a valid token in Authorization header to get a fresh one.

        // Let's go with: Client sends { token } in body.
        const { token } = await req.json()

        if (!token) {
            return Response.json({ error: "Token required" }, { status: 400 })
        }

        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

        // Check validity. 
        // Note: If token is expired, jwtVerify throws. 
        // For a true refresh flow, you'd typically have a separate long-lived refresh token in DB.
        // Since we are doing a simple JWT setup without DB sessions for tokens, 
        // we allow refreshing ONLY if the current token is still valid (proactive refresh).

        const { payload } = await jwtVerify(token, secret)

        // Issue new token
        const newToken = await new SignJWT({
            userId: payload.userId,
            email: payload.email
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret)

        return Response.json({ token: newToken })

    } catch (error) {
        return Response.json(
            { error: "Invalid or expired token" },
            { status: 401 }
        )
    }
}
