import { PrismaClient } from "@prisma/client";

declare global {
  var __stuttgartPulsePrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__stuttgartPulsePrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__stuttgartPulsePrisma__ = prisma;
}
