"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("URL:", process.env.DATABASE_URL);
    console.log("Connecting...");
    const count = await prisma.user.count();
    console.log(`Users: ${count}`);
}
main()
    .catch(e => console.error("Error:", e))
    .finally(async () => await prisma.$disconnect());
