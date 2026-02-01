import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log("URL:", process.env.DATABASE_URL)
    console.log("Connecting...")
    const count = await prisma.user.count()
    console.log(`Users: ${count}`)
}

main()
    .catch(e => console.error("Error:", e))
    .finally(async () => await prisma.$disconnect())
