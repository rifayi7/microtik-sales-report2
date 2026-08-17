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
      status INTEGER DEFAULT 1,
      UNIQUE(camp_name, validity_name)
    );
  `);

  // Seed default companies
  const checkCompanies = await db.execute("SELECT COUNT(*) as count FROM companies");
  const compCount = Number(checkCompanies.rows[0]?.count ?? 0);
  if (compCount === 0) {
    await db.batch([
      { sql: "INSERT OR IGNORE INTO companies (name) VALUES (?)", args: ["Apricom DXB"] },
      { sql: "INSERT OR IGNORE INTO companies (name) VALUES (?)", args: ["Apricom KSA"] },
    ], "write");
  }

  // Seed default camps
  const checkCamps = await db.execute("SELECT COUNT(*) as count FROM camps");
  const campsCount = Number(checkCamps.rows[0]?.count ?? 0);
  if (campsCount === 0) {
    await db.batch([
      { sql: "INSERT OR IGNORE INTO camps (name, company_name, hotspot_name, strength) VALUES (?, ?, ?, ?)", args: ["APM-RIMAL-1", "Apricom KSA", "APM-RIMAL-1", 1000] },
      { sql: "INSERT OR IGNORE INTO camps (name, company_name, hotspot_name, strength) VALUES (?, ?, ?, ?)", args: ["APM-DXB-camp-1", "Apricom DXB", "APM-DXB-camp-1", 500] },
      { sql: "INSERT OR IGNORE INTO camps (name, company_name, hotspot_name, strength) VALUES (?, ?, ?, ?)", args: ["Hassani 3", "Apricom DXB", "Apricom-3", 500] },
      { sql: "INSERT OR IGNORE INTO camps (name, company_name, hotspot_name, strength) VALUES (?, ?, ?, ?)", args: ["Hassani 2", "Apricom DXB", "Apricom-2", 500] },
    ], "write");
  }

  // Seed default validity profiles
  const checkVp = await db.execute("SELECT COUNT(*) as count FROM validity_profiles");
  const vpCount = Number(checkVp.rows[0]?.count ?? 0);
  if (vpCount === 0) {
    const defaultVps = ["7-Days", "15-D", "30-D", "6-Days", "30-Days", "15-Days", "10-Days", "5-Days"];
    await db.batch(
      defaultVps.map(name => ({ sql: "INSERT OR IGNORE INTO validity_profiles (name) VALUES (?)", args: [name] })),
      "write"
    );
  }

  // Seed default camp validity pricing mapping
  const checkCvp = await db.execute("SELECT COUNT(*) as count FROM camp_validity_pricing");
  const cvpCount = Number(checkCvp.rows[0]?.count ?? 0);
  if (cvpCount === 0) {
    await db.batch([
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["APM-RIMAL-1", "30-Days", "Apricom KSA", 30, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["APM-DXB-camp-1", "15-Days", "Apricom DXB", 16, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["APM-DXB-camp-1", "30-Days", "Apricom DXB", 32, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["KSAYSG-1", "15-D", "Apricom KSA", 25, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["KSAYSG-1", "30-D", "Apricom KSA", 40, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["APM-KSA-Wenz-1", "15-Days", "Apricom KSA", 20, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["APM-KSA-Wenz-1", "30-Days", "Apricom KSA", 30, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["APM-KSA-1", "7-Days", "Apricom KSA", 15, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["APM-Muzain-1", "15-Days", "Apricom KSA", 20, 0] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["APM-Muzain-1", "30-Days", "Apricom KSA", 25, 0] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["Hassani 3", "15-Days", "Apricom DXB", 16, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["Hassani 3", "30-Days", "Apricom DXB", 32, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["Hassani 2", "15-Days", "Apricom DXB", 16, 1] },
      { sql: "INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) VALUES (?, ?, ?, ?, ?)", args: ["Hassani 2", "30-Days", "Apricom DXB", 32, 1] },
    ], "write");
  }

  // Create notifications table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camp_name TEXT NOT NULL,
      user_name TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0
    );
  `);

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

  // Create users table for authentication
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  // Seed default expenses
  const checkExpenses = await db.execute("SELECT COUNT(*) as count FROM expenses");
  const expensesCount = Number(checkExpenses.rows[0]?.count ?? 0);
  if (expensesCount === 0) {
    await db.batch([
      { sql: "INSERT OR IGNORE INTO expenses (company_name, common_category, expense_category, supplier_name, expense_date, expense_by, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: ["Apricom DXB", null, "Office Rent", "Landlord Ltd", "2026-08-01", "Akif", 12000.00, "Rent for Aug 2026"] },
      { sql: "INSERT OR IGNORE INTO expenses (company_name, common_category, expense_category, supplier_name, expense_date, expense_by, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [null, "Hardware Purchase", "Office Equipment", "Supplier XYZ", "2026-08-05", "Muzain", 1500.00, "Bought 10 routers"] },
    ], "write");
  }

  // Seed default credentials
  const checkUsers = await db.execute("SELECT COUNT(*) as count FROM users");
  const usersCount = Number(checkUsers.rows[0]?.count ?? 0);
  if (usersCount === 0) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)",
      args: ["iqbaal", "admin"],
    });
  }

  // Seed default pricing if none exists
  const checkPricing = await db.execute("SELECT COUNT(*) as count FROM sales_pricing");
  const countRow = Number(checkPricing.rows[0]?.count ?? 0);
  if (countRow === 0) {
    await db.batch([
      { sql: "INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)", args: [7, 70] },
      { sql: "INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)", args: [10, 100] },
      { sql: "INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)", args: [15, 150] },
      { sql: "INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)", args: [30, 300] },
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
