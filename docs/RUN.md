# اجرای پروژه (توسعه)

## پیش‌نیاز

- Node.js 20+
- MySQL/MariaDB
- (اختیاری) Redis — با `REDIS_DISABLED=true` غیرفعال می‌شود

## Backend

```powershell
cd backend
copy .env.example .env
# DATABASE_URL و JWT_SECRET را تنظیم کنید
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API: `http://localhost:3001/api`

## Frontend

```powershell
cd frontend
copy .env.example .env
# NUXT_PUBLIC_API_BASE=http://localhost:3001/api
# NUXT_PUBLIC_SITE_URL=http://localhost:3000
# NUXT_PUBLIC_FORCE_DEMO_CATALOG=false  # برای خاموش کردن محصولات/بنرهای نمایشی
npm install
npx nuxt prepare
npm run dev
```

### کاتالوگ نمایشی (بدون DB)

به‌صورت پیش‌فرض فروشگاه **۱۲ محصول** و **۳ بنر Hero** با تصاویر Unsplash نشان می‌دهد. برای اتصال به API واقعی: `NUXT_PUBLIC_FORCE_DEMO_CATALOG=false`

## Seed پوشاک در MySQL

```powershell
cd backend
npx prisma db push
npm run db:seed:clothing-demo
```

فروشگاه: `http://localhost:3000` — پنل: `/admin/login`

## مهاجرت پوشاک

پس از pull، یک بار `npx prisma db push` برای فیلد `clothingMeta` روی جدول products.

## متغیرهای محیطی (بدون مقادیر)

| محل | متغیر |
|-----|--------|
| Backend | `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `ADMIN_PHONE`, `ADMIN_PASSWORD`, `FARAZSMS_*` |
| Frontend | `NUXT_PUBLIC_API_BASE`, `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_NESHAN_API_KEY` |
