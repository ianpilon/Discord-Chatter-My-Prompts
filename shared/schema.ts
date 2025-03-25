import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Original users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Discord servers table
export const discordServers = pgTable("discord_servers", {
  id: text("id").primaryKey(), // Discord server ID
  name: text("name").notNull(),
  icon: text("icon"),
  isActive: boolean("is_active").notNull().default(true),
  lastSynced: timestamp("last_synced"),
});

export const insertDiscordServerSchema = createInsertSchema(discordServers);
export type InsertDiscordServer = z.infer<typeof insertDiscordServerSchema>;
export type DiscordServer = typeof discordServers.$inferSelect;

// Discord channels table
export const discordChannels = pgTable("discord_channels", {
  id: text("id").primaryKey(), // Discord channel ID
  serverId: text("server_id").notNull().references(() => discordServers.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertDiscordChannelSchema = createInsertSchema(discordChannels);
export type InsertDiscordChannel = z.infer<typeof insertDiscordChannelSchema>;
export type DiscordChannel = typeof discordChannels.$inferSelect;

// Channel summaries table
export const channelSummaries = pgTable("channel_summaries", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => discordChannels.id, { onDelete: 'cascade' }),
  summary: text("summary").notNull(),
  messageCount: integer("message_count").notNull(),
  activeUsers: integer("active_users"),
  keyTopics: text("key_topics").array(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const insertChannelSummarySchema = createInsertSchema(channelSummaries);
export type InsertChannelSummary = z.infer<typeof insertChannelSummarySchema>;
export type ChannelSummary = typeof channelSummaries.$inferSelect;

// Server statistics table
export const serverStats = pgTable("server_stats", {
  id: serial("id").primaryKey(), 
  serverId: text("server_id").notNull().references(() => discordServers.id, { onDelete: 'cascade' }),
  totalMessages: integer("total_messages").notNull(),
  activeUsers: integer("active_users").notNull(),
  activeChannels: integer("active_channels").notNull(),
  percentChange: jsonb("percent_change").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const insertServerStatsSchema = createInsertSchema(serverStats);
export type InsertServerStats = z.infer<typeof insertServerStatsSchema>;
export type ServerStats = typeof serverStats.$inferSelect;

// User settings table
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  summaryFrequency: text("summary_frequency").notNull().default("24h"), // 24h, 12h, 6h
  detailLevel: text("detail_level").notNull().default("standard"), // standard, detailed, concise
  emailNotifications: boolean("email_notifications").notNull().default(false),
  webNotifications: boolean("web_notifications").notNull().default(true),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings);
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// Discord messages table
export const discordMessages = pgTable("discord_messages", {
  id: text("id").primaryKey(), // Discord message ID
  channelId: text("channel_id").notNull().references(() => discordChannels.id, { onDelete: 'cascade' }),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

export const insertDiscordMessageSchema = createInsertSchema(discordMessages);
export type InsertDiscordMessage = z.infer<typeof insertDiscordMessageSchema>;
export type DiscordMessage = typeof discordMessages.$inferSelect;
