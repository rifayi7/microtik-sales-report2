import { createClient } from "@libsql/client";
import path from "path";

// Initialize the Turso client
const envPath = process.env.DATABASE_PATH || "../microtik/vouchers.db";
const dbUrl = process.env.TURSO_DATABASE_URL || `file:${path.resolve(envPath)}`;
const dbToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({
  url: dbUrl,
  authToken: dbToken,
});

let isInitialized = false;

export async function initializeDB() {
  if (isInitialized) return db;

  // Create table for custom sales pricing if it doesn't exist
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales_pricing (
      validity_days INTEGER PRIMARY KEY,
      price REAL NOT NULL
    );
  `);

  // Create super_admins table for root platform administrators
  await db.execute(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create companies table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  // Create camps table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS camps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      company_name TEXT,
      hotspot_name TEXT,
      strength INTEGER DEFAULT 500
    );
  `);

  // Create validity_profiles table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS validity_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  // Create camp_validity_pricing table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS camp_validity_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camp_name TEXT NOT NULL,
      validity_name TEXT NOT NULL,
      company_name TEXT,
      price REAL NOT NULL,
      unit REAL DEFAULT 1.0,
      status INTEGER DEFAULT 1,
      UNIQUE(camp_name, validity_name)
    );
  `);

  try {
    await db.execute("ALTER TABLE camp_validity_pricing ADD COLUMN unit REAL DEFAULT 1.0;");
  } catch (e) {}

  // Create notifications table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camp_name TEXT,
      user_name TEXT,
      category TEXT,
      title TEXT,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      target_type TEXT DEFAULT 'ALL',
      company_id INTEGER,
      company_name TEXT,
      created_by TEXT,
      created_at TEXT,
      expires_at TEXT,
      is_read INTEGER DEFAULT 0
    );
  `);

  try { await db.execute("ALTER TABLE notifications ADD COLUMN camp_name TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN user_name TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN category TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN title TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'info';"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN target_type TEXT DEFAULT 'ALL';"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN company_id INTEGER;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN company_name TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN created_by TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN created_at TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN expires_at TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE notifications ADD COLUMN is_read INTEGER DEFAULT 0;"); } catch {}

  // Create report_users table if not exists (shared with microtik main portal)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT,
      company_id INTEGER REFERENCES companies(id),
      allowed_camp_ids TEXT,
      status INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  try { await db.execute("ALTER TABLE report_users ADD COLUMN status INTEGER DEFAULT 1;"); } catch {}

  // Create payments table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paid_by_user TEXT NOT NULL,
      camp_name TEXT NOT NULL,
      paid_for_year_month TEXT NOT NULL,
      amount REAL NOT NULL,
      collected_by TEXT,
      split_by TEXT,
      payment_date TEXT,
      payment_time TEXT,
      verified_status INTEGER DEFAULT 0
    );
  `);

  // Seed default notifications
  const checkNotif = await db.execute("SELECT COUNT(*) as count FROM notifications");
  const notifCount = Number(checkNotif.rows[0]?.count ?? 0);
  if (notifCount === 0) {
    await db.batch([
      { sql: "INSERT OR IGNORE INTO notifications (camp_name, user_name, category, message, is_read) VALUES (?, ?, ?, ?, ?)", args: ["APM-RIMAL-1", "admin", "System Alert", "Router disconnected from main gateway.", 0] },
      { sql: "INSERT OR IGNORE INTO notifications (camp_name, user_name, category, message, is_read) VALUES (?, ?, ?, ?, ?)", args: ["Hassani 2", "iqbaal", "User Login", "Agent iqbaal logged in from device mobile.", 1] },
    ], "write");
  }

  // Seed default payments
  const checkPayments = await db.execute("SELECT COUNT(*) as count FROM payments");
  const paymentsCount = Number(checkPayments.rows[0]?.count ?? 0);
  if (paymentsCount === 0) {
    await db.batch([
      { sql: "INSERT OR IGNORE INTO payments (paid_by_user, camp_name, paid_for_year_month, amount, collected_by, split_by, payment_date, payment_time, verified_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: ["iqbaal", "APM-DXB-camp-1", "2026-08", 500.0, "admin", "System", "2026-08-11", "21:30:00", 1] },
      { sql: "INSERT OR IGNORE INTO payments (paid_by_user, camp_name, paid_for_year_month, amount, collected_by, split_by, payment_date, payment_time, verified_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: ["sales_agent_2", "Hassani 2", "2026-08", 250.0, "admin", "Manual", "2026-08-10", "14:20:00", 0] },
    ], "write");
  }

  // Create expenses table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT,
      common_category TEXT,
      expense_category TEXT NOT NULL,
      supplier_name TEXT,
      expense_date TEXT NOT NULL,
      expense_by TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT
    );
  `);

  // Seed default pricing if none exists
  const checkPricing = await db.execute("SELECT COUNT(*) as count FROM sales_pricing");
  const countRow = Number(checkPricing.rows[0]?.count ?? 0);
  if (countRow === 0) {
    await db.batch([
      { sql: "INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)", args: [7, 70] },
      { sql: "INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)", args: [10, 100] },
      { sql: "INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)", args: [15, 16] },
      { sql: "INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)", args: [30, 32] },
    ], "write");
  }

  isInitialized = true;
  return db;
}

export async function getDB() {
  await initializeDB();
  return db;
}

// Get the current prices configuration as a key-value map
export async function getPricingMap(): Promise<Record<number, number>> {
  const database = await getDB();
  const res = await database.execute("SELECT validity_days, price FROM sales_pricing");
  
  const pricingMap: Record<number, number> = {};
  for (const row of res.rows) {
    const vDays = Number(row.validity_days);
    const vPrice = Number(row.price);
    pricingMap[vDays] = vPrice;
  }
  return pricingMap;
}

// Update or insert a price for a specific plan
export async function updatePrice(validity_days: number, price: number) {
  const database = await getDB();
  await database.execute({
    sql: `
      INSERT INTO sales_pricing (validity_days, price) 
      VALUES (?, ?)
      ON CONFLICT(validity_days) DO UPDATE SET price = excluded.price
    `,
    args: [validity_days, price],
  });
}
