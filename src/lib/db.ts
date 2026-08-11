import { DatabaseSync } from "node:sqlite";
import path from "path";

let dbInstance: DatabaseSync | null = null;

export function getDB(): DatabaseSync {
  if (dbInstance) return dbInstance;

  // Resolve DB Path from environment variable or fallback to default
  const envPath = process.env.DATABASE_PATH;
  const dbPath = envPath 
    ? path.resolve(envPath) 
    : path.resolve(process.cwd(), "../microtik/vouchers.db");

  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL mode for concurrency and set busy timeout
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA busy_timeout = 5000;");

  // Create table for custom sales pricing if it doesn't exist
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sales_pricing (
      validity_days INTEGER PRIMARY KEY,
      price REAL NOT NULL
    );
  `);

  // Create companies table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  // Create camps table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS camps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      company_name TEXT,
      hotspot_name TEXT,
      strength INTEGER DEFAULT 500
    );
  `);

  // Create validity_profiles table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS validity_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  // Create camp_validity_pricing table
  dbInstance.exec(`
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
  const checkCompanies = dbInstance.prepare("SELECT COUNT(*) as count FROM companies");
  const compCount = (checkCompanies.get() as { count: number }).count;
  if (compCount === 0) {
    const insertComp = dbInstance.prepare("INSERT OR IGNORE INTO companies (name) VALUES (?)");
    insertComp.run("Apricom DXB");
    insertComp.run("Apricom KSA");
  }

  // Seed default camps
  const checkCamps = dbInstance.prepare("SELECT COUNT(*) as count FROM camps");
  const campsCount = (checkCamps.get() as { count: number }).count;
  if (campsCount === 0) {
    const insertCamp = dbInstance.prepare(`
      INSERT OR IGNORE INTO camps (name, company_name, hotspot_name, strength) 
      VALUES (?, ?, ?, ?)
    `);
    insertCamp.run("APM-RIMAL-1", "Apricom KSA", "APM-RIMAL-1", 1000);
    insertCamp.run("APM-DXB-camp-1", "Apricom DXB", "APM-DXB-camp-1", 500);
    insertCamp.run("Hassani 3", "Apricom DXB", "Apricom-3", 500);
    insertCamp.run("Hassani 2", "Apricom DXB", "Apricom-2", 500);
  }

  // Seed default validity profiles
  const checkVp = dbInstance.prepare("SELECT COUNT(*) as count FROM validity_profiles");
  const vpCount = (checkVp.get() as { count: number }).count;
  if (vpCount === 0) {
    const insertVp = dbInstance.prepare("INSERT OR IGNORE INTO validity_profiles (name) VALUES (?)");
    const defaultVps = ["7-Days", "15-D", "30-D", "6-Days", "30-Days", "15-Days", "10-Days", "5-Days"];
    defaultVps.forEach(name => insertVp.run(name));
  }

  // Seed default camp validity pricing mapping
  const checkCvp = dbInstance.prepare("SELECT COUNT(*) as count FROM camp_validity_pricing");
  const cvpCount = (checkCvp.get() as { count: number }).count;
  if (cvpCount === 0) {
    const insertCvp = dbInstance.prepare(`
      INSERT OR IGNORE INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertCvp.run("APM-RIMAL-1", "30-Days", "Apricom KSA", 30, 1);
    insertCvp.run("APM-DXB-camp-1", "15-Days", "Apricom DXB", 16, 1);
    insertCvp.run("APM-DXB-camp-1", "30-Days", "Apricom DXB", 32, 1);
    insertCvp.run("KSAYSG-1", "15-D", "Apricom KSA", 25, 1);
    insertCvp.run("KSAYSG-1", "30-D", "Apricom KSA", 40, 1);
    insertCvp.run("APM-KSA-Wenz-1", "15-Days", "Apricom KSA", 20, 1);
    insertCvp.run("APM-KSA-Wenz-1", "30-Days", "Apricom KSA", 30, 1);
    insertCvp.run("APM-KSA-1", "7-Days", "Apricom KSA", 15, 1);
    insertCvp.run("APM-Muzain-1", "15-Days", "Apricom KSA", 20, 0);
    insertCvp.run("APM-Muzain-1", "30-Days", "Apricom KSA", 25, 0);
    insertCvp.run("Hassani 3", "15-Days", "Apricom DXB", 16, 1);
    insertCvp.run("Hassani 3", "30-Days", "Apricom DXB", 32, 1);
    insertCvp.run("Hassani 2", "15-Days", "Apricom DXB", 16, 1);
    insertCvp.run("Hassani 2", "30-Days", "Apricom DXB", 32, 1);
  }

  // Create notifications table
  dbInstance.exec(`
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
  dbInstance.exec(`
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
  const checkNotif = dbInstance.prepare("SELECT COUNT(*) as count FROM notifications");
  const notifCount = (checkNotif.get() as { count: number }).count;
  if (notifCount === 0) {
    const insertNotif = dbInstance.prepare(`
      INSERT OR IGNORE INTO notifications (camp_name, user_name, category, message, is_read)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertNotif.run("APM-RIMAL-1", "admin", "System Alert", "Router disconnected from main gateway.", 0);
    insertNotif.run("Hassani 2", "iqbaal", "User Login", "Agent iqbaal logged in from device mobile.", 1);
  }

  // Seed default payments
  const checkPayments = dbInstance.prepare("SELECT COUNT(*) as count FROM payments");
  const paymentsCount = (checkPayments.get() as { count: number }).count;
  if (paymentsCount === 0) {
    const insertPayment = dbInstance.prepare(`
      INSERT OR IGNORE INTO payments (paid_by_user, camp_name, paid_for_year_month, amount, collected_by, split_by, payment_date, payment_time, verified_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPayment.run("iqbaal", "APM-DXB-camp-1", "2026-08", 500.0, "admin", "System", "2026-08-11", "21:30:00", 1);
    insertPayment.run("sales_agent_2", "Hassani 2", "2026-08", 250.0, "admin", "Manual", "2026-08-10", "14:20:00", 0);
  }

  // Create expenses table
  dbInstance.exec(`
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
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  // Seed default expenses
  const checkExpenses = dbInstance.prepare("SELECT COUNT(*) as count FROM expenses");
  const expensesCount = (checkExpenses.get() as { count: number }).count;
  if (expensesCount === 0) {
    const insertExpense = dbInstance.prepare(`
      INSERT OR IGNORE INTO expenses (company_name, common_category, expense_category, supplier_name, expense_date, expense_by, amount, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertExpense.run("Apricom DXB", null, "Office Rent", "Landlord Ltd", "2026-08-01", "Akif", 12000.00, "Rent for Aug 2026");
    insertExpense.run(null, "Hardware Purchase", "Office Equipment", "Supplier XYZ", "2026-08-05", "Muzain", 1500.00, "Bought 10 routers");
  }

  // Seed default credentials
  const checkUsers = dbInstance.prepare("SELECT COUNT(*) as count FROM users");
  const usersCount = (checkUsers.get() as { count: number }).count;
  if (usersCount === 0) {
    const insertUser = dbInstance.prepare("INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)");
    insertUser.run("iqbaal", "admin");
  }

  // Seed default pricing if none exists
  const checkPricing = dbInstance.prepare("SELECT COUNT(*) as count FROM sales_pricing");
  const countRow = checkPricing.get() as { count: number } | undefined;
  
  if (countRow && countRow.count === 0) {
    const insertStmt = dbInstance.prepare(`
      INSERT INTO sales_pricing (validity_days, price) VALUES (?, ?)
    `);
    // Default prices in AED/currency (7 days = 70, 10 days = 100, 15 days = 150, 30 days = 300)
    insertStmt.run(7, 70);
    insertStmt.run(10, 100);
    insertStmt.run(15, 150);
    insertStmt.run(30, 300);
  }

  return dbInstance;
}

// Get the current prices configuration as a key-value map
export function getPricingMap(): Record<number, number> {
  const db = getDB();
  const stmt = db.prepare("SELECT validity_days, price FROM sales_pricing");
  const rows = stmt.all() as { validity_days: number; price: number }[];
  
  const pricingMap: Record<number, number> = {};
  for (const row of rows) {
    pricingMap[row.validity_days] = row.price;
  }
  return pricingMap;
}

// Update or insert a price for a specific plan
export function updatePrice(validity_days: number, price: number) {
  const db = getDB();
  const stmt = db.prepare(`
    INSERT INTO sales_pricing (validity_days, price) 
    VALUES (?, ?)
    ON CONFLICT(validity_days) DO UPDATE SET price = excluded.price
  `);
  stmt.run(validity_days, price);
}
