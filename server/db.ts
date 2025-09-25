import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  sqliteTable,
  text,
  integer,
  boolean
} from "drizzle-orm/sqlite-core";
import { opcuaNodesTable, plcsTable } from "@shared/schema";

const sqlite = new Database("./database.sqlite");
export const db = drizzle(sqlite);

// Initialize database tables using Drizzle push (run separately via CLI)
// For now, no manual creation needed as schema is managed by Drizzle Kit

// Export the tables for use in other files
export { opcuaNodesTable, plcsTable };
