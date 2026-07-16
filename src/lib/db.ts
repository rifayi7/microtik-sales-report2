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
