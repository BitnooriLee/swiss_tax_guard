/**
 * Drizzle ORM Configuration
 * 
 * This file configures Drizzle ORM, a TypeScript ORM for SQL databases.
 * It defines how database migrations are generated and where schema definitions are located.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Output directory for generated SQL migrations
  out: "./sql/migrations",
  
  // Single barrel re-exports all feature schemas (see app/db/schema.ts).
  schema: "./app/db/schema.ts",
  
  // Database dialect - using PostgreSQL
  dialect: "postgresql",
  
  // Database connection credentials - using environment variable for security
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
