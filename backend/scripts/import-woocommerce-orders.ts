/**
 * Import WooCommerce customers (from order billing) + orders into the new shop.
 * Read-only towards WordPress. Does NOT change WP or re-decrement stock.
 *
 * Usage:
 *   npx tsx scripts/import-woocommerce-orders.ts --orders-file=/path/to/orders.json
 *
 * Env:
 *   WP_STORE_BASE_URL=https://aaytay.ir
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { normalizeDigits } from '../src/utils/normalize';

const prisma = new PrismaClient();
const WP_BASE = (process.env.WP_STORE_BASE_URL ?? 'https://aaytay.ir').replace(/\/$/, '');

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const ORDERS_FILE =
  argValue('--orders-file=') ||
  path.join(process.cwd(), 'scripts', 'data', 'wc-orders.json');

type WcBilling = {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
};

type WcLineItem = {
  id: number;
  name: string;
  product_id: number;
  quantity: number;
  total: string;
  price: number;
  sku?: string;
};

type WcOrder = {
  id: number;
  status: string;
  currency?: string;
  date_created?: string;
  date_modified?: string;
  discount_total?: string;
  shipping_total?: string;
  total?: string;
  customer_id?: number;
  customer_note?: string;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  billing?: WcBilling;
  shipping?: WcBilling;
  line_items?: WcLineItem[];
  shipping_lines?: Array<{ method_title?: string; method_id?: string; total?: string }>;
  coupon_lines?: Array<{ code?: string; discount?: string }>;
  meta_data?: Array<{ key?: string; value?: unknown }>;
};

function tryNormalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let normalized = normalizeDigits(String(raw)).replace(/\D/g, '');
  if (normalized.startsWith('98')) normalized = '0' + normalized.slice(2);
  if (!normalized.startsWith('0')) normalized = '0' + normalized;
  if (!/^09\d{9}$/.test(normalized)) return null;
  return normalized;
}

function toman(raw: string | number | undefined | null): number {
  const n = parseInt(String(raw ?? '0').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function mapStatus(status: string): OrderStatus {
  switch (status) {
    case 'completed':
      return OrderStatus.DELIVERED;
    case 'cancelled':
    case 'refunded':
    case 'failed':
    case 'trash':
      return OrderStatus.CANCELLED;
    case 'processing':
      return OrderStatus.PREPARING;
    case 'on-hold':
    case 'pending':
      return OrderStatus.REVIEWING;
    default:
      return OrderStatus.NEW;
  }
}

function mapPayment(method: string | undefined): PaymentMethod {
  const m = (method || '').toLowerCase();
  if (m.includes('zibal') || m.includes('gateland') || m.includes('online')) {
    return PaymentMethod.ZIBAL;
  }
  if (m.includes('cod') || m.includes('cash')) {
    return PaymentMethod.CASH_AT_DOOR;
  }
  return PaymentMethod.ZIBAL;
}

function fullName(b?: WcBilling | null): string {
  const name = `${b?.first_name || ''} ${b?.last_name || ''}`.trim();
  return name || 'مشتری';
}

function buildAddress(order: WcOrder): {
  address: string;
  province?: string;
  city?: string;
  postalCode?: string;
} {
  const ship = order.shipping || {};
  const bill = order.billing || {};
  const src = (ship.address_1 || ship.city ? ship : bill) as WcBilling;
  const parts = [src.address_1, src.address_2, src.company].filter(Boolean);
  const address = parts.join('، ').trim() || 'آدرس ثبت‌نشده (واردات از وردپرس)';
  return {
    address,
    province: src.state || undefined,
    city: src.city || undefined,
    postalCode: src.postcode || undefined,
  };
}

async function fetchWpProductIdToSlug(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const url = `${WP_BASE}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'aayat-order-import/1.0' },
    });
    if (!res.ok) throw new Error(`WP products HTTP ${res.status}`);
    totalPages = Number(res.headers.get('X-WP-TotalPages') || 1);
    const rows = (await res.json()) as Array<{ id: number; slug: string }>;
    for (const p of rows) {
      if (p?.id && p?.slug) map.set(p.id, p.slug);
    }
    page += 1;
  }
  return map;
}

async function ensureStubCategory(): Promise<string> {
  const slug = 'wp-legacy';
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: {
      name: 'محصولات قدیمی (وارداتی)',
      slug,
      sortOrder: 9999,
      isActive: false,
    },
  });
  return created.id;
}

async function resolveProductId(
  wpProductId: number,
  itemName: string,
  wpIdToSlug: Map<number, string>,
  slugToLocalId: Map<string, string>,
  stubCategoryId: string,
  stubCache: Map<number, string>,
): Promise<string> {
  const slug = wpIdToSlug.get(wpProductId);
  if (slug && slugToLocalId.has(slug)) {
    return slugToLocalId.get(slug)!;
  }
  if (stubCache.has(wpProductId)) return stubCache.get(wpProductId)!;

  const stubSlug = `wp-missing-${wpProductId}`;
  const existing = await prisma.product.findUnique({ where: { slug: stubSlug }, select: { id: true } });
  if (existing) {
    stubCache.set(wpProductId, existing.id);
    return existing.id;
  }

  const created = await prisma.product.create({
    data: {
      name: itemName || `محصول حذف‌شده #${wpProductId}`,
      slug: stubSlug,
      description: 'این ردیف برای حفظ تاریخچه سفارش‌های وردپرس ساخته شده (محصول در کاتالوگ فعلی نیست).',
      price: 0,
      stock: 0,
      categoryId: stubCategoryId,
      isActive: false,
      isFeatured: false,
      isNew: false,
    },
  });
  stubCache.set(wpProductId, created.id);
  slugToLocalId.set(stubSlug, created.id);
  return created.id;
}

async function main() {
  if (!fs.existsSync(ORDERS_FILE)) {
    throw new Error(`Orders file not found: ${ORDERS_FILE}`);
  }

  const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')) as WcOrder[];
  console.log(`Loaded ${orders.length} WooCommerce orders from ${ORDERS_FILE}`);

  console.log('Building WP product id → slug map…');
  const wpIdToSlug = await fetchWpProductIdToSlug();
  console.log(`WP products mapped: ${wpIdToSlug.size}`);

  const localProducts = await prisma.product.findMany({ select: { id: true, slug: true } });
  const slugToLocalId = new Map(localProducts.map((p) => [p.slug, p.id]));
  console.log(`Local products: ${slugToLocalId.size}`);

  const stubCategoryId = await ensureStubCategory();
  const stubCache = new Map<number, string>();

  // Upsert customers from billing phones
  type Person = {
    phone: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    address?: ReturnType<typeof buildAddress>;
  };
  const people = new Map<string, Person>();
  for (const order of orders) {
    const phone = tryNormalizePhone(order.billing?.phone);
    if (!phone) continue;
    const prev = people.get(phone);
    const firstName = order.billing?.first_name?.trim() || prev?.firstName;
    const lastName = order.billing?.last_name?.trim() || prev?.lastName;
    const email = (order.billing?.email || '').trim() || prev?.email;
    people.set(phone, {
      phone,
      firstName,
      lastName,
      email: email || undefined,
      address: buildAddress(order),
    });
  }
  console.log(`Unique customers by phone: ${people.size}`);

  let usersCreated = 0;
  let usersUpdated = 0;
  const phoneToUserId = new Map<string, string>();

  for (const person of people.values()) {
    const existing = await prisma.user.findUnique({ where: { phone: person.phone } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName: existing.firstName || person.firstName || null,
          lastName: existing.lastName || person.lastName || null,
          email: existing.email || person.email || null,
        },
      });
      phoneToUserId.set(person.phone, updated.id);
      usersUpdated += 1;

      const addrCount = await prisma.address.count({ where: { userId: existing.id } });
      if (addrCount === 0 && person.address) {
        await prisma.address.create({
          data: {
            userId: existing.id,
            title: 'آدرس پیش‌فرض',
            address: person.address.address,
            province: person.address.province,
            city: person.address.city,
            postalCode: person.address.postalCode,
            isDefault: true,
          },
        });
      }
    } else {
      const created = await prisma.user.create({
        data: {
          phone: person.phone,
          firstName: person.firstName || null,
          lastName: person.lastName || null,
          email: person.email || null,
          role: 'CUSTOMER',
          isActive: true,
          addresses: person.address
            ? {
                create: {
                  title: 'آدرس پیش‌فرض',
                  address: person.address.address,
                  province: person.address.province,
                  city: person.address.city,
                  postalCode: person.address.postalCode,
                  isDefault: true,
                },
              }
            : undefined,
        },
      });
      phoneToUserId.set(person.phone, created.id);
      usersCreated += 1;
    }
  }
  console.log(`Users created=${usersCreated} updated=${usersUpdated}`);

  let ordersCreated = 0;
  let ordersSkipped = 0;
  let itemsCreated = 0;

  for (const order of orders) {
    const externalId = `wc:${order.id}`;
    const exists = await prisma.order.findUnique({ where: { externalId }, select: { id: true } });
    if (exists) {
      ordersSkipped += 1;
      continue;
    }

    const phone = tryNormalizePhone(order.billing?.phone);
    if (!phone) {
      console.warn(`Skip order ${order.id}: invalid phone`);
      ordersSkipped += 1;
      continue;
    }

    const userId = phoneToUserId.get(phone) || null;
    const addr = buildAddress(order);
    const shippingAmount = toman(order.shipping_total);
    const discountAmount = toman(order.discount_total);
    const totalPrice = toman(order.total);
    const lineItems = order.line_items || [];
    const subtotal = lineItems.reduce((sum, it) => sum + toman(it.total), 0);
    const couponCode = order.coupon_lines?.[0]?.code || null;
    const shippingTitle = order.shipping_lines?.[0]?.method_title || null;

    const paymentDetails: Record<string, unknown> = {
      source: 'woocommerce',
      wpOrderId: order.id,
      wpStatus: order.status,
      paymentMethodTitle: order.payment_method_title || null,
      transactionId: order.transaction_id || null,
      shippingMethod: shippingTitle,
      importedAt: new Date().toISOString(),
    };
    for (const meta of order.meta_data || []) {
      if (!meta?.key) continue;
      if (meta.key.startsWith('zibal_') || meta.key.includes('ref') || meta.key.includes('card')) {
        paymentDetails[meta.key] = meta.value;
      }
    }

    const createdAt = order.date_created ? new Date(order.date_created) : new Date();
    const orderNumber = `WC-${order.id}`;

    const itemRows: Array<{ productId: string; quantity: number; price: number; name: string }> = [];
    for (const it of lineItems) {
      const productId = await resolveProductId(
        it.product_id,
        it.name,
        wpIdToSlug,
        slugToLocalId,
        stubCategoryId,
        stubCache,
      );
      const qty = Math.max(1, Number(it.quantity) || 1);
      const lineTotal = toman(it.total);
      const unit = Math.round(lineTotal / qty) || Math.round(Number(it.price) || 0);
      itemRows.push({
        productId,
        quantity: qty,
        price: unit,
        name: it.name,
      });
    }

    if (!itemRows.length) {
      console.warn(`Skip order ${order.id}: no line items`);
      ordersSkipped += 1;
      continue;
    }

    await prisma.order.create({
      data: {
        orderNumber,
        externalId,
        userId,
        subtotal,
        discountAmount,
        shippingAmount,
        totalPrice,
        couponCode,
        status: mapStatus(order.status),
        paymentMethod: mapPayment(order.payment_method),
        paymentDetails: paymentDetails as Prisma.InputJsonValue,
        customerName: fullName(order.billing),
        customerPhone: phone,
        customerEmail: (order.billing?.email || '').trim() || null,
        deliveryAddress: addr.address,
        deliveryProvince: addr.province,
        deliveryCity: addr.city,
        deliveryPostalCode: addr.postalCode,
        notes: order.customer_note || null,
        createdAt,
        updatedAt: order.date_modified ? new Date(order.date_modified) : createdAt,
        items: { create: itemRows },
        statusLogs: {
          create: {
            status: mapStatus(order.status),
            note: 'واردات از ووکامرس',
          },
        },
      },
    });

    ordersCreated += 1;
    itemsCreated += itemRows.length;
  }

  console.log(
    JSON.stringify(
      {
        usersCreated,
        usersUpdated,
        ordersCreated,
        ordersSkipped,
        itemsCreated,
        stubProducts: stubCache.size,
      },
      null,
      2,
    ),
  );
  console.log('IMPORT_ORDERS_OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
