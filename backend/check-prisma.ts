import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  console.log('client:', typeof (p as any).client);
  console.log('user:', typeof p.user);
  console.log('deal:', typeof (p as any).deal);
  console.log('session:', typeof p.session);
}
main().finally(() => p.$disconnect());
