import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Updates the user's interest vector based on a post they interacted with.
 * Logic: NewInterest = (OldInterest * decay) + (PostVector * weight)
 */
export async function updateUserInterest(userId: string, postId: string, weight: number = 0.05) {
    try {
        // 1. Fetch Post Embedding
        const postData = await prisma.$queryRaw`
            SELECT embedding::text FROM "Post" WHERE id = ${postId}
        ` as any[];

        if (!postData.length || !postData[0].embedding) {
            return; // No embedding to learn from
        }

        const postVectorStr = postData[0].embedding; // "[0.1, 0.2, ...]"
        const postVector = JSON.parse(postVectorStr) as number[];

        // 2. Fetch User Interest Embedding
        const userData = await prisma.$queryRaw`
            SELECT "interestEmbedding"::text FROM "User" WHERE id = ${userId}
        ` as any[];

        if (!userData.length) return;

        let newVector: number[];
        const userVectorStr = userData[0].interestEmbedding;

        if (!userVectorStr) {
            // Cold start: If user has no profile, take the post's vector directly (or heavily weighted)
            newVector = postVector;
        } else {
            // Weighted Average
            const userVector = JSON.parse(userVectorStr) as number[];

            // Ensure dimensions match
            if (userVector.length !== postVector.length) {
                console.warn(`Vector dimension mismatch: User ${userVector.length} vs Post ${postVector.length}`);
                return;
            }

            const decay = 1.0 - weight;
            newVector = userVector.map((val, i) => (val * decay) + (postVector[i] * weight));
        }

        // 3. Update User
        // Use executeRaw to save vector
        const vectorString = `[${newVector.join(',')}]`;
        await prisma.$executeRaw`
            UPDATE "User" 
            SET "interestEmbedding" = ${vectorString}::vector 
            WHERE id = ${userId}
        `;

        // console.log(`[Learning] Updated interest profile for user ${userId}`);
    } catch (error) {
        console.error("[Learning] Error updating user interest:", error);
    }
}
