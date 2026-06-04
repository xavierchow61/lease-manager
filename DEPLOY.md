# 部署指南 — Supabase + GitHub + Vercel

本專案已改用 **PostgreSQL（Supabase）**。以下是從零到上線的完整步驟。
（我這邊已把程式、設定檔、build 都準備並驗證好了；以下需要你用自己的帳號操作。）

---

## 步驟 1️⃣ 建立 Supabase 資料庫

1. 到 <https://supabase.com> 註冊並 **New Project**（選一個區域，設定一個資料庫密碼，記下來）。
2. 專案建立後，左下角 **Project Settings → Database → Connection string**。
3. 取兩條連線字串（把 `[YOUR-PASSWORD]` 換成你設定的密碼）：
   - **Transaction（pooler, 6543 埠）** → 這是 `DATABASE_URL`，**結尾要加 `?pgbouncer=true`**
   - **Session（direct, 5432 埠）** → 這是 `DIRECT_URL`

---

## 步驟 2️⃣ 本機建立資料表 + 管理員帳號

把上面兩條字串填進專案根目錄的 `.env`：

```env
DATABASE_URL="postgresql://postgres.xxxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:5432/postgres"
SESSION_SECRET="（已自動產生，保持不變即可）"
```

然後在專案資料夾執行：

```bash
npm install
npx prisma db push     # 在 Supabase 建立所有資料表
npm run db:seed        # 建立示範業主/租客帳號與範例資料
```

> 上線後請**馬上登入並改密碼**，或自行註冊新的業主帳號後刪除示範帳號。
> 若不想要示範資料，可跳過 `db:seed`，改成註冊頁自行建立業主帳號。

本機驗證（可選）：`npm run dev` → <http://localhost:3001> 應能連到 Supabase 並登入。

---

## 步驟 3️⃣ 推上 GitHub

```bash
git remote add origin https://github.com/<你的帳號>/<repo 名稱>.git
git branch -M main
git push -u origin main
```

（`.env` 已被 `.gitignore` 忽略，密鑰不會上傳。）

---

## 步驟 4️⃣ 部署到 Vercel

1. 到 <https://vercel.com> 用 GitHub 登入 → **Add New → Project** → 匯入剛才的 repo。
2. Framework 會自動偵測為 **Next.js**，Build 設定保持預設即可
   （`postinstall` 會自動跑 `prisma generate`）。
3. 在 **Environment Variables** 加入三個變數（值與你 `.env` 相同）：
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | 你的 Supabase pooler 連線字串（含 `?pgbouncer=true`） |
   | `DIRECT_URL` | 你的 Supabase direct 連線字串 |
   | `SESSION_SECRET` | 一段長隨機字串（沿用 `.env` 那個即可） |
4. **Deploy**。完成後會給你一個 `https://<專案>.vercel.app` 網址。

---

## 之後更新

改完程式 `git push`，Vercel 會自動重新部署。
若日後**改了資料表結構**（`prisma/schema.prisma`），記得本機再跑一次：

```bash
npx prisma db push
```

---

## 常見問題

- **登入後一直跳回登入頁**：多半是 `SESSION_SECRET` 沒設定或 Vercel 環境變數沒填。
- **連不到資料庫 / build 失敗**：確認 `DATABASE_URL` 用的是 **6543 pooler**、`DIRECT_URL` 用 **5432 direct**，密碼正確、`?pgbouncer=true` 沒漏。
- **寄信 / Stripe**：預設為本機 log 模式，不影響部署；要啟用再填對應環境變數。
- **想用其他主機（Render/Railway）**：一樣設那三個環境變數即可；Build 指令 `npm run build`、Start 指令 `npm start`。
