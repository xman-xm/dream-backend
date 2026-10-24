
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import getEmbedding dynamically to ensure env vars are loaded
async function main() {
    const { getEmbedding } = await import('../lib/gemini');
    // Use dynamic import for prisma to ensure env vars are loaded if needed (though lib/prisma likely loads them)
    // Actually, lib/prisma usually imports @prisma/client top level.
    // Let's rely on dotenv loading first.
    const { prisma } = await import('../lib/prisma');

    try {
        console.log("🚀 Starting Embeddings Backfill...");

        // 1. Backfill Groups
        const groups = await prisma.$queryRaw<{ id: string, name: string, description: string }[]>`
            SELECT id, name, description FROM "Group" WHERE embedding IS NULL
        `;
        console.log(`📦 Found ${groups.length} Groups to backfill.`);

        for (const group of groups) {
            const text = `${group.name} ${group.description || ''}`.trim();
            if (!text) continue;

            const vector = await getEmbedding(text);
            if (vector) {
                const vectorString = `[${vector.join(',')}]`;
                await prisma.$executeRaw`UPDATE "Group" SET embedding = ${vectorString}::vector WHERE id = ${group.id}`;
                process.stdout.write('.');
            }
            await new Promise(r => setTimeout(r, 200)); // Rate limit
        }
        console.log("\n✅ Groups done.");

        // 2. Backfill Posts
        const posts = await prisma.$queryRaw<{ id: string, caption: string, aiDescription: string }[]>`
            SELECT id, caption, "aiDescription" FROM "Post" WHERE embedding IS NULL
        `;
        console.log(`📝 Found ${posts.length} Posts to backfill.`);

        for (const post of posts) {
            const text = `${post.caption || ''} ${post.aiDescription || ''}`.trim();
            if (!text) continue;

            const vector = await getEmbedding(text);
            if (vector) {
                const vectorString = `[${vector.join(',')}]`;
                await prisma.$executeRaw`UPDATE "Post" SET embedding = ${vectorString}::vector WHERE id = ${post.id}`;
                process.stdout.write('.');
            }
            await new Promise(r => setTimeout(r, 200)); // Rate limit
        }
        console.log("\n✅ Posts done.");

        // 3. Backfill Users (Bio + Name)
        const users = await prisma.$queryRaw<{ id: string, name: string, username: string, bio: string }[]>`
            SELECT id, name, username, bio FROM "User" WHERE embedding IS NULL
        `;
        console.log(`busts_in_silhouette Found ${users.length} Users to backfill.`);

        for (const user of users) {
            const text = `${user.name || ''} ${user.username} ${user.bio || ''}`.trim();
            if (!text) continue;

            const vector = await getEmbedding(text);
            if (vector) {
                const vectorString = `[${vector.join(',')}]`;
                await prisma.$executeRaw`UPDATE "User" SET embedding = ${vectorString}::vector WHERE id = ${user.id}`;
                process.stdout.write('.');
            }
            await new Promise(r => setTimeout(r, 200));
        }
        console.log("\n✅ Users done.");

    } catch (error) {
        console.error("❌ Backfill failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
