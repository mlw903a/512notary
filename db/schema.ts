import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const rateLimits = sqliteTable('rate_limits', {bucket:text('bucket').primaryKey(),hits:integer('hits').notNull()});
export const calendarBlocks = sqliteTable('calendar_blocks', {
  id:text('id').primaryKey(), provider:text('provider').notNull(), start:integer('start').notNull(), end:integer('end').notNull(), reason:text('reason').notNull(), createdAt:integer('created_at').notNull()
},table=>[index('calendar_blocks_provider_start').on(table.provider,table.start)]);

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(), owner: text('owner').notNull(),
  provider: text('provider').notNull(), zip: text('zip').notNull(),
  start: integer('start').notNull(), end: integer('end').notNull(),
  name: text('name').notNull(), email: text('email').notNull(), address: text('address').notNull(),
  quantity: integer('quantity').notNull(), total: integer('total').notNull().default(7500),
  status: text('status').notNull().default('test_confirmed'), version: integer('version').notNull().default(1),
  fingerprint: text('fingerprint').notNull(), source: text('source').notNull().default('{}'),
  createdAt: integer('created_at').notNull()
}, table => [index('bookings_owner_start').on(table.owner, table.start)]);

export const slotLocks = sqliteTable('slot_locks', {
  provider: text('provider').notNull(), slot: integer('slot').notNull(),
  bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' })
}, table => [primaryKey({ columns: [table.provider, table.slot] }), index('slot_locks_booking').on(table.bookingId)]);

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(), bookingId: text('booking_id').notNull().references(() => bookings.id),
  owner: text('owner').notNull(), kind: text('kind').notNull(), recipient: text('recipient').notNull(),
  subject: text('subject').notNull(), body: text('body').notNull(), dueAt: integer('due_at').notNull(),
  status: text('status').notNull().default('preview')
}, table => [index('notifications_booking').on(table.bookingId)]);

export const inquiries = sqliteTable('inquiries', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), kind: text('kind').notNull(),
  zip: text('zip').notNull(), detail: text('detail').notNull(), email: text('email').notNull(),
  createdAt: integer('created_at').notNull()
}, table => [index('inquiries_owner_created').on(table.owner, table.createdAt)]);

export const events = sqliteTable('events', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(),
  zip: text('zip'), source: text('source').notNull(), createdAt: integer('created_at').notNull()
}, table => [index('events_owner_created').on(table.owner, table.createdAt)]);
