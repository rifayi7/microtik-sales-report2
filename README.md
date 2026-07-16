# HotSpot Pro - Sales Reporting Dashboard

A premium, interactive sales reporting and analytics dashboard for **MikroTik Hotspot Voucher Management**. This application connects directly to the core database (`vouchers.db`) to provide detailed reporting on agents, plans, and voucher sales.

## 🚀 Key Features

*   📊 **Real-time Metrics**: Total revenue, sales count, active agents, and today vs. yesterday comparative growth.
*   📈 **Interactive Trends**: Line & area charts displaying daily/monthly sales volume and revenue trends.
*   👥 **Agent Leaderboard**: Rank and track agent sales performance, vouchers sold, and generated revenue.
*   📝 **Detailed Sales Logs**: Search, sort, and filter individual transactions by Date Range, Agent, Plan Duration, Router ID, and customer phone number or voucher code.
*   📥 **CSV Export**: Export filtered sales reports for accounting and offline analysis.
*   ⚙️ **Pricing Settings**: Custom validity-to-price mapping saved directly to SQLite to dynamically calculate revenue.

---

## 🛠️ Setup Instructions

### 1. Database Configuration
Create a `.env.local` file in the root directory (one has been pre-created for you) with the path pointing to your main voucher application's database:

```env
DATABASE_PATH=C:/Users/User/Documents/microtik/vouchers.db
```

### 2. Start the Application
Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the dashboard.

---

## 📦 Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 & PostCSS
- **Database**: Native SQLite (`node:sqlite`)
- **Charts**: Recharts
- **Icons**: Lucide React
