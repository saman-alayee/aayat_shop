/**
 * Import useful WP content pages + WooCommerce coupons into the new shop.
 * Pages: public GET. Coupons: from --coupons-file JSON (exported via WC REST).
 *
 * Usage:
 *   npx tsx scripts/import-woocommerce-content-coupons.ts
 *   npx tsx scripts/import-woocommerce-content-coupons.ts --coupons-file=./scripts/data/wc-coupons.json
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient, CouponType } from '@prisma/client';

const prisma = new PrismaClient();
const WP_BASE = (process.env.WP_STORE_BASE_URL ?? 'https://aaytay.ir').replace(/\/$/, '');

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const COUPONS_FILE =
  argValue('--coupons-file=') ||
  path.join(process.cwd(), 'scripts', 'data', 'wc-coupons.json');

/** WP pages worth keeping as ContentPage (skip cart/checkout/shop/account/home builders). */
const PAGE_SLUG_MAP: Record<string, string> = {
  terms: 'terms',
  'about-us': 'about-us',
  'contact-us': 'contact-us',
  code: 'order-tracking',
};

type WpPage = {
  id: number;
  slug: string;
  status: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
};

type WcCoupon = {
  id: number;
  code: string;
  amount: string;
  discount_type: string;
  description?: string;
  usage_count?: number;
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  date_expires?: string | null;
  date_created?: string | null;
  minimum_amount?: string;
  maximum_amount?: string;
  free_shipping?: boolean;
  status?: string;
};

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function toman(raw: string | number | undefined | null): number {
  const n = Math.round(parseFloat(String(raw ?? '0').replace(/[^\d.]/g, '')) || 0);
  return Number.isFinite(n) ? n : 0;
}

async function importPages() {
  const res = await fetch(`${WP_BASE}/wp-json/wp/v2/pages?per_page=50&status=publish`, {
    headers: { Accept: 'application/json', 'User-Agent': 'aayat-content-import/1.0' },
  });
  if (!res.ok) throw new Error(`WP pages HTTP ${res.status}`);
  const pages = (await res.json()) as WpPage[];

  let upserted = 0;
  let skipped = 0;

  for (const page of pages) {
    const targetSlug = PAGE_SLUG_MAP[page.slug];
    if (!targetSlug) {
      skipped += 1;
      continue;
    }

    const title = decodeHtml(page.title?.rendered || page.slug);
    const body = (page.content?.rendered || '').trim();
    if (!body && targetSlug !== 'order-tracking') {
      console.warn(`Skip page ${page.slug}: empty body`);
      skipped += 1;
      continue;
    }

    await prisma.contentPage.upsert({
      where: { slug: targetSlug },
      create: {
        slug: targetSlug,
        title,
        body: body || `<p>${title}</p>`,
        isPublished: true,
      },
      update: {
        title,
        body: body || undefined,
        isPublished: true,
      },
    });
    upserted += 1;
    console.log(`Page upserted: ${page.slug} -> ${targetSlug} (${body.length} chars)`);
  }

  return { upserted, skipped, totalWp: pages.length };
}

function mapCoupon(c: WcCoupon): {
  code: string;
  title: string;
  type: CouponType;
  value: number;
  minPurchase: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
} | null {
  const code = (c.code || '').trim().toUpperCase();
  if (!code) return null;

  const amount = parseFloat(String(c.amount || '0')) || 0;
  let type: CouponType = 'PERCENT';
  let value = 0;

  if (c.discount_type === 'percent') {
    type = 'PERCENT';
    value = Math.round(amount);
  } else if (c.discount_type === 'fixed_cart' || c.discount_type === 'fixed_product') {
    type = 'FIXED';
    value = toman(amount);
  } else {
    type = 'PERCENT';
    value = Math.round(amount);
  }

  // Free-shipping-only coupons often have amount 0 — keep as inactive percent marker with title.
  const titleParts = [
    (c.description || '').trim(),
    c.free_shipping ? 'ارسال رایگان' : '',
  ].filter(Boolean);

  const endDate = c.date_expires ? new Date(c.date_expires) : null;
  const expired = endDate ? endDate.getTime() < Date.now() : false;
  const isActive = c.status !== 'draft' && !expired;

  const maxRaw = toman(c.maximum_amount);
  return {
    code,
    title: titleParts.join(' — ') || code,
    type,
    value,
    minPurchase: toman(c.minimum_amount),
    maxDiscount: maxRaw > 0 ? maxRaw : null,
    usageLimit: c.usage_limit ?? null,
    perUserLimit: c.usage_limit_per_user ?? null,
    usedCount: c.usage_count ?? 0,
    startDate: c.date_created ? new Date(c.date_created) : null,
    endDate,
    isActive,
  };
}

async function importCoupons() {
  if (!fs.existsSync(COUPONS_FILE)) {
    console.warn(`Coupons file missing: ${COUPONS_FILE}`);
    return { upserted: 0, skipped: 0 };
  }
  const coupons = JSON.parse(fs.readFileSync(COUPONS_FILE, 'utf8')) as WcCoupon[];
  let upserted = 0;
  let skipped = 0;

  for (const raw of coupons) {
    const mapped = mapCoupon(raw);
    if (!mapped) {
      skipped += 1;
      continue;
    }

    await prisma.coupon.upsert({
      where: { code: mapped.code },
      create: {
        code: mapped.code,
        title: mapped.title,
        type: mapped.type,
        value: mapped.value,
        minPurchase: mapped.minPurchase,
        maxDiscount: mapped.maxDiscount,
        usageLimit: mapped.usageLimit,
        perUserLimit: mapped.perUserLimit,
        usedCount: mapped.usedCount,
        startDate: mapped.startDate,
        endDate: mapped.endDate,
        isActive: mapped.isActive,
      },
      update: {
        title: mapped.title,
        type: mapped.type,
        value: mapped.value,
        minPurchase: mapped.minPurchase,
        maxDiscount: mapped.maxDiscount,
        usageLimit: mapped.usageLimit,
        perUserLimit: mapped.perUserLimit,
        usedCount: mapped.usedCount,
        startDate: mapped.startDate,
        endDate: mapped.endDate,
        isActive: mapped.isActive,
      },
    });
    upserted += 1;
    console.log(`Coupon upserted: ${mapped.code} (${mapped.type} ${mapped.value}) active=${mapped.isActive}`);
  }

  return { upserted, skipped };
}

async function main() {
  console.log(`Import content/coupons from ${WP_BASE}`);
  const pages = await importPages();
  const coupons = await importCoupons();
  console.log(JSON.stringify({ pages, coupons }, null, 2));
  console.log('IMPORT_CONTENT_COUPONS_OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
