import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clinicCases = pgTable("clinic_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  topicId: text("topic_id").notNull(),
  kind: text("kind").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  rating: integer("rating"),
  status: text("status").notNull().default("open"),
  operatorReply: text("operator_reply").notNull().default(""),
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("clinic_cases_owner_created").on(table.ownerId, table.createdAt)]);

export const clinicCaseHistory = pgTable("clinic_case_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull().references(() => clinicCases.id),
  revision: integer("revision").notNull(),
  status: text("status").notNull(),
  operatorReply: text("operator_reply").notNull(),
  actorId: text("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("clinic_case_history_case_revision").on(table.caseId, table.revision)]).enableRLS();

export const insertClinicCaseSchema = createInsertSchema(clinicCases).omit({ id: true, revision: true, createdAt: true, updatedAt: true });
export type InsertClinicCase = z.infer<typeof insertClinicCaseSchema>;
export type ClinicCaseRecord = typeof clinicCases.$inferSelect;
