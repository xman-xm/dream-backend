export async function POST() {
    // Since we are using stateless JWTs, "logout" is primarily a client-side action 
    // (deleting the token from SecureStore).

    // If we implemented a token blacklist (Redis/DB), we would add the token here.

    return Response.json({ message: "Logged out successfully" })
}
