import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
}

const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false } // Required for some neon connections if strict
});

async function main() {
    console.log('Starting vector migration (768 -> 3072) using pg...');

    try {
        await client.connect();

        // 1. Clear existing vectors
        console.log('Clearing old 768-dim vectors...');
        await client.query(`UPDATE "User" SET "embedding" = NULL, "interestEmbedding" = NULL`);
        await client.query(`UPDATE "Post" SET "embedding" = NULL`);
        await client.query(`UPDATE "Group" SET "embedding" = NULL`);

        // 2. Alter columns
        console.log('Altering column types to vector(3072)...');

        await client.query(`ALTER TABLE "User" ALTER COLUMN "embedding" TYPE vector(3072)`);
        await client.query(`ALTER TABLE "User" ALTER COLUMN "interestEmbedding" TYPE vector(3072)`);
        await client.query(`ALTER TABLE "Post" ALTER COLUMN "embedding" TYPE vector(3072)`);
        await client.query(`ALTER TABLE "Group" ALTER COLUMN "embedding" TYPE vector(3072)`);

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.end();
    }
}

main();
