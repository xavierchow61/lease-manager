# 詳細部署教學 — Supabase + GitHub + Vercel

從零到網站上線，照著做即可。預計 15–20 分鐘。
程式碼已在 GitHub：<https://github.com/xavierchow61/lease-manager>

> 名詞：**Supabase** = 放資料的雲端資料庫；**Vercel** = 放網站、對外提供網址的主機；
> **GitHub** = 放程式碼，Vercel 會從這裡自動抓程式去部署。

---

## 第一部分：建立 Supabase 資料庫

### 1-1 建立專案
1. 開 <https://supabase.com> →「Start your project」→ 用 GitHub 登入。
2. 點 **New project**。
3. 填：
   - **Name**：`lease`（隨意）
   - **Database Password**：點 **Generate a password**，並**複製記下來**（等下要用，忘了要重設）。
   - **Region**：選離你近的，例如 `Southeast Asia (Singapore)`。
4. 按 **Create new project**，等約 1–2 分鐘讓它建立完成。

### 1-2 取得兩條連線字串（重點）
1. 專案建好後，點畫面**最上方的「Connect」**按鈕（或 Project Settings → Database）。
2. 在彈出視窗選 **ORMs** 分頁（或 Connection string）。會看到適用 Prisma 的兩條字串：
   - **Transaction pooler**（埠 **6543**）→ 這是 `DATABASE_URL`
   - **Session pooler**（埠 **5432**）→ 這是 `DIRECT_URL`
3. 把字串裡的 `[YOUR-PASSWORD]` 換成你在 1-3 記下的資料庫密碼。

最後你會得到類似這樣兩條（注意埠號 6543 與 5432 的差別）：

```
DATABASE_URL = postgresql://postgres.abcd1234:你的密碼@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL   = postgresql://postgres.abcd1234:你的密碼@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

> 重點：`DATABASE_URL`（6543）結尾要有 **`?pgbouncer=true&connection_limit=1`**——
> 少了 `connection_limit=1`，併發查詢會出現 `Can't reach database server`（P1001）。
> 密碼若含特殊符號（如 `!`），要做 URL 編碼（`!` → `%21`）。

---

## 第二部分：本機建立資料表與管理員帳號

> 這步在你自己的電腦做一次，把資料表「灌」進 Supabase，並建立可登入的帳號。

1. 打開專案資料夾的 `.env`，把上面兩條字串貼進去（`SESSION_SECRET` 保持原本那串即可）：

   ```env
   DATABASE_URL="postgresql://postgres.abcd1234:你的密碼@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.abcd1234:你的密碼@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   SESSION_SECRET="（保持原本那串隨機字）"
   ```

2. 在專案資料夾開終端機，執行：

   ```bash
   npm install
   npx prisma db push     # 在 Supabase 建立所有資料表
   npm run db:seed        # 建立示範業主/租客帳號 + 範例資料
   ```

   看到 `Your database is now in sync` 與種子完成訊息就成功了。

3. （可選）本機先試跑：`npm run dev` → 開 <http://localhost:3001> →
   用 `owner@demo.com` / `demo1234` 應該能登入。

> 想去 Supabase 看資料：左側 **Table Editor** 就能看到 `Account`、`Unit`、`Payment` 等表。

---

## 第三部分：部署到 Vercel

1. 開 <https://vercel.com> →「Sign Up / Log in」→ 用 **GitHub** 登入。
2. 首頁點 **Add New… → Project**。
3. 在 repo 清單找到 **lease-manager** → 按 **Import**。
   （第一次用要授權 Vercel 存取你的 GitHub。）
4. 進到設定頁，**Framework Preset** 會自動是 **Next.js**，其餘保持預設。
5. 展開 **Environment Variables**，加入這三個（Name 與 Value 一字不差）：

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | 你的 6543 pooler 字串（含 `?pgbouncer=true`） |
   | `DIRECT_URL` | 你的 5432 字串 |
   | `SESSION_SECRET` | `.env` 裡那串隨機字 |

6. 按 **Deploy**，等 1–3 分鐘。
7. 完成後會看到 🎉 與一個網址，例如 `https://lease-manager-xxxx.vercel.app`，點進去就是你的線上系統。

---

## 第四部分：上線後

1. 用 `owner@demo.com` / `demo1234` 登入 → 進「設定」**立刻改密碼**。
   （或自己用註冊頁建一個業主帳號，再到 Supabase Table Editor 刪掉示範帳號。）
2. 之後改程式 → `git push` → Vercel 會自動重新部署。
3. 若改了資料表結構（`prisma/schema.prisma`），本機再跑一次 `npx prisma db push`。

---

## 疑難排解

| 症狀 | 原因 / 解法 |
|---|---|
| `prisma db push` 卡住或連不上 | `DATABASE_URL` 要用 **6543**、`DIRECT_URL` 要用 **5432**；密碼正確；`?pgbouncer=true` 沒漏 |
| Vercel build 失敗，提到 prisma | 確認三個環境變數都加了；重新 Deploy |
| 線上登入一直跳回登入頁 | `SESSION_SECRET` 沒設或與本機不同——Vercel 環境變數補上即可 |
| 密碼忘了（Supabase） | Supabase → Settings → Database → Reset database password，改完記得更新 `.env` 與 Vercel 變數 |
| 想換主機（Render/Railway） | 一樣設那三個環境變數；Build `npm run build`、Start `npm start` |
