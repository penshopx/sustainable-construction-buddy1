import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Metadata only. Uploaded file bytes live in private App Storage.
export const vaultWorkspaces = pgTable("rs_workspaces", {
  ownerId: text("owner_id").primaryKey(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertVaultWorkspaceSchema = createInsertSchema(vaultWorkspaces);
export type VaultWorkspaceRow = typeof vaultWorkspaces.$inferSelect;
