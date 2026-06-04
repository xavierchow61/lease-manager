# 物業 / 租客管理系統 Pro（本機現代版）

由原本的 Google Apps Script + Google Sheets 版本重建而成的現代化網站，
可在本機（Windows / Mac）直接執行與預覽。

- **框架**：Next.js 14（App Router）+ TypeScript
- **資料庫**：SQLite + Prisma（檔案型，零安裝，資料存在 `prisma/dev.db`）
- **樣式**：Tailwind CSS
- **登入**：bcrypt 雜湊密碼 + httpOnly cookie session（改良原本明文存密碼的問題）
- **Email / Stripe**：可插拔。預設「本機 log 模式」——不真的寄信/扣款，
  動作會印在啟動的終端機中。填入 `.env` 金鑰後即可接上真實服務。

---

## 🗄️ 資料庫

本專案使用 **PostgreSQL（Supabase）**。請先建立一個 Supabase 專案，把連線字串填入 `.env`
（範本見 `.env.example`）。完整步驟見 **[DEPLOY.md](DEPLOY.md)**。

## 🚀 快速開始（本機）

1. 複製 `.env.example` 為 `.env`，填入 Supabase 的 `DATABASE_URL` 與 `DIRECT_URL`。
2. 執行：

```bash
npm install          # 安裝相依套件（會自動 prisma generate）
npm run setup        # 在資料庫建立資料表 + 載入示範資料（= db push + seed）
npm run dev          # 啟動開發伺服器
```

開啟瀏覽器： **http://localhost:3001**

> `啟動系統.bat`／`重置示範資料.bat` 仍可用，但前提是 `.env` 已填好 Supabase 連線字串。

## ☁️ 部署上線

見 **[DEPLOY.md](DEPLOY.md)** —— Supabase + GitHub + Vercel 一步步教學。

### 示範帳號

| 角色 | 帳號 | 密碼 |
|---|---|---|
| 業主（Max 方案，已解鎖全部功能） | `owner@demo.com` | `demo1234` |
| 租客 | `tenant@demo.com`（或租客 ID `T001`） | `demo1234` |

> 重置資料庫：`npm run db:seed`（會清空並重新載入示範資料）

---

## ✨ 功能對照（原系統 → 本版）

| 模組 | 功能 |
|---|---|
| 帳號 | 業主註冊 / 登入、租客登入（Email 或租客 ID）、忘記密碼（寄臨時密碼）、首次登入強制改密碼 |
| 單位 | 新增 / 編輯 / 刪除單位、自動建立租客帳號並寄送開通信、搜尋與篩選、退租封存 |
| 收款 | 開立帳單 / 收據、標記繳清、部分收款、刪除、自動發票編號（INV-年-序號）、**單據 PDF 預覽列印**、**依租客篩選** |
| 帳務工具 | 一鍵生成本月租金、**水電抄表計費**、預付款登記、押金收據/發票、退租結算 |
| 水電抄表 | 系統記住上期錶讀數，只需輸入今期讀數即自動算用量與費用，生成後讀數自動結轉下期 |
| 維修 | 租客報修（可附照片）、業主處理回覆並自動通知（Pro 方案） |
| 支出 | 財務支出（Max）：分類記帳、本月/本年/全部統計、分類佔比、月份+分類篩選、可編輯刪除 |
| 報表 | 年度收支總覽（租金/押金/管理費/水電/維修/支出/淨利）+ 12 個月明細表 |
| 入退住清單 | 每位租客的入住/退住點檢清單，可勾選、增刪、儲存 |
| 通知 | 合約到期提醒、逾期催款、月結單寄送 |
| 方案 | Free / Pro / Max 三級，功能依方案分級鎖定，可一鍵切換（模擬升級） |
| 設定 | 更改顯示名稱、預設貨幣單位、重設密碼（需驗證舊密碼）、檢視帳號資訊 |
| 多幣別 | HK$ / ¥ / $ / MOP$ / NT$ / £ |

---

## 🔌 接上真實服務（選用）

編輯 `.env`：

- **Email**：填入 `SMTP_HOST` 等欄位後，於 `src/lib/email.ts` 解除 nodemailer 註解，
  並 `npm i nodemailer`。
- **Stripe**：填入 `STRIPE_SECRET_KEY` 與價格 ID，於 `src/app/api/account/upgrade/route.ts`
  改為建立 Checkout Session（目前本機版以一鍵切換模擬）。

---

## 📁 專案結構

```
prisma/
  schema.prisma     資料模型（8 張表）
  seed.ts           示範資料
src/
  lib/              db / session / 認證 / 方案限制 / 金額格式 / email / 業務服務
  app/api/          所有後端 API 路由（auth、units、payments、repairs…）
  app/page.tsx      入口
  components/       App / Login / Shell / 業主後台 / 租客後台 / 共用 UI
```

> 原始 Google Apps Script 版本保留為參考：`index.html.txt`、`程式碼.gs.txt`
