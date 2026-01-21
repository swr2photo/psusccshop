# 🚀 Supabase Migration Guide

## Overview

This project has been migrated from Filebase S3 storage to Supabase PostgreSQL database for improved performance, real-time capabilities, and SQL querying.

## Prerequisites

1. Create a Supabase account at https://supabase.com
2. Create a new Supabase project
3. Note your project URL and API keys

## Step 1: Set up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the schema script: `scripts/supabase-schema.sql`
4. This will create all required tables:
   - `orders` - Customer orders with payment info
   - `config` - Shop configuration (settings, products, announcements)
   - `profiles` - Customer saved profiles
   - `carts` - Saved shopping carts
   - `email_logs` - Email sending history
   - `user_logs` - User activity logs
   - `data_requests` - PDPA data requests
   - `key_value_store` - Generic key-value storage

## Step 2: Configure Environment Variables

Add these to your `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these values from:
- Supabase Dashboard → Settings → API
- Copy the Project URL
- Copy the anon public key
- Copy the service_role secret key

## Step 3: Migrate Existing Data (Optional)

If you have existing data in Filebase S3:

```bash
# Make sure Filebase credentials are still in .env.local
# Then run the migration script
npx ts-node scripts/migrate-to-supabase.ts
```

The migration script will:
- Read all orders from Filebase S3
- Read all configs, profiles, carts
- Transform data to SQL format
- Insert into Supabase tables

## Step 4: Verify Migration

1. Check Supabase Table Editor to verify data
2. Test the application locally with `npm run dev`
3. Verify orders load correctly
4. Verify config/shop settings work
5. Test creating a new order

## Database Schema

### Orders Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| ref | VARCHAR | Order reference (unique) |
| date | TIMESTAMPTZ | Order date |
| status | VARCHAR | Order status |
| customer_name | VARCHAR | Customer name |
| customer_email | VARCHAR | Customer email |
| email_hash | VARCHAR | SHA-256 hash for privacy |
| customer_phone | VARCHAR | Phone number |
| customer_address | TEXT | Shipping address |
| cart | JSONB | Cart items |
| total_amount | DECIMAL | Total price |
| slip_data | JSONB | Payment slip info |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

### Config Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key | VARCHAR | Config key (unique) |
| value | JSONB | Config value |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Updated timestamp |

## API Compatibility

The migration maintains full backward compatibility:

- `getJson(key)` - Works the same, now queries Supabase
- `putJson(key, data)` - Works the same, now writes to Supabase
- `listKeys(prefix)` - Works the same, now queries Supabase
- `deleteObject(key)` - Works the same, now deletes from Supabase

New optimized functions available:
- `getOrdersByEmail(email, options)` - Paginated orders by email
- `getAllOrders(options)` - Admin paginated orders with search
- `getOrderByRef(ref)` - Direct order lookup
- `updateOrderByRef(ref, updates)` - Direct order update
- `getExpiredUnpaidOrders(hours)` - For cron jobs

## Benefits of Supabase

1. **SQL Queries** - Complex filtering, sorting, aggregation
2. **Better Performance** - Indexed queries instead of scanning files
3. **Real-time** - Subscriptions for live updates (future feature)
4. **Pagination** - Built-in offset/limit support
5. **Full-text Search** - PostgreSQL text search capabilities
6. **Row Level Security** - Fine-grained access control
7. **Auto Timestamps** - Updated_at triggers
8. **Backups** - Automatic daily backups

## Troubleshooting

### "NEXT_PUBLIC_SUPABASE_URL is not set"
Make sure your `.env.local` has the correct Supabase URL.

### "Invalid API key"
Check that your `SUPABASE_SERVICE_ROLE_KEY` is correct. The service role key bypasses RLS for server-side operations.

### "Table does not exist"
Run the schema script in SQL Editor first.

### Migration script fails
- Check Filebase credentials are still valid
- Check Supabase credentials
- Check network connectivity

## Rolling Back

If you need to rollback to Filebase:

1. Keep your old `filebase.ts` as `filebase-backup.ts`
2. Restore the original `filebase.ts` content
3. Remove Supabase environment variables
4. The old code should work without changes

## Support

For issues with:
- Supabase setup: https://supabase.com/docs
- Migration script: Check console output for errors
- Application issues: Check browser console and server logs
