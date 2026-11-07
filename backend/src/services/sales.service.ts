import type { PaymentMethod, OrderStatus, Prisma } from '@prisma/client';
import prisma from '../config/database';

/** Shop operates in Iran; VPS clock is UTC. */
const TEHRAN_TZ = 'Asia/Tehran';
/** Iran has no DST — fixed UTC+3:30. */
const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

export interface SalesFilters {
  days?: number;
  dateFrom?: string;
  dateTo?: string;
  productSearch?: string;
  /** Filter transactions list: paid (revenue), pending, failed, or all */
  paymentBucket?: 'paid' | 'pending' | 'failed' | 'all';
}

type PayFields = {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentDetails: Prisma.JsonValue | null;
};

function paymentDetailsOf(order: PayFields): Record<string, unknown> | null {
  if (
    order.paymentDetails &&
    typeof order.paymentDetails === 'object' &&
    !Array.isArray(order.paymentDetails)
  ) {
    return order.paymentDetails as Record<string, unknown>;
  }
  return null;
}

function paymentStatusOf(order: PayFields): string {
  return String(paymentDetailsOf(order)?.paymentStatus || '').toLowerCase();
}

/**
 * Payment badge bucket — aligned with storefront payment UI.
 */
export function getOrderPaymentBucket(
  order: PayFields
): 'paid' | 'pending' | 'failed' | 'cod' {
  const ps = paymentStatusOf(order);
  if (ps === 'paid') return 'paid';
  if (ps === 'failed') return 'failed';
  if (order.paymentMethod === 'CASH_AT_DOOR') return 'cod';
  if (ps === 'pending' || order.status === 'REVIEWING') return 'pending';
  if (order.status === 'CANCELLED') return 'failed';
  return 'paid';
}

/**
 * Strict revenue: money that counts as a completed sale.
 * - Zibal: only explicit paymentStatus=paid, or legacy progressed orders without pending/failed flag
 * - COD: confirmed non-cancelled (not stuck in reviewing)
 * - Never: CANCELLED, REVIEWING unpaid, pending, failed
 */
export function isCountedRevenue(order: PayFields): boolean {
  if (order.status === 'CANCELLED') return false;

  const ps = paymentStatusOf(order);
  if (ps === 'paid') return true;
  if (ps === 'pending' || ps === 'failed') return false;
  if (order.status === 'REVIEWING') return false;

  if (order.paymentMethod === 'CASH_AT_DOOR') {
    return ['NEW', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(order.status);
  }

  // Zibal / wallets without explicit flag (legacy WC imports): only progressed statuses
  return ['NEW', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(order.status);
}

function tehranDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** YYYY-MM-DD as a Tehran calendar day → UTC instant at 00:00:00 Tehran. */
function tehranDayStartUtc(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - TEHRAN_OFFSET_MS);
}

function tehranDayEndUtc(isoDate: string): Date {
  return new Date(tehranDayStartUtc(isoDate).getTime() + 24 * 60 * 60 * 1000 - 1);
}

function addCalendarDays(isoDate: string, delta: number): string {
  const start = tehranDayStartUtc(isoDate);
  return tehranDateKey(new Date(start.getTime() + delta * 24 * 60 * 60 * 1000 + TEHRAN_OFFSET_MS));
}

function tehranMonthKey(date: Date): string {
  return tehranDateKey(date).slice(0, 7);
}

/** Friday in Tehran calendar. */
function isTehranFriday(isoDate: string): boolean {
  const mid = new Date(tehranDayStartUtc(isoDate).getTime() + 12 * 60 * 60 * 1000);
  return mid.getUTCDay() === 5;
}

function resolveRange(filters: SalesFilters = {}) {
  const { days = 30, dateFrom, dateTo } = filters;
  const todayKey = tehranDateKey(new Date());

  if (dateFrom || dateTo) {
    const fromKey = (dateFrom || '1970-01-01').slice(0, 10);
    const toKey = (dateTo || todayKey).slice(0, 10);
    return {
      since: tehranDayStartUtc(fromKey),
      until: tehranDayEndUtc(toKey),
      fromKey,
      toKey,
    };
  }

  // Last N Tehran calendar days inclusive of today
  const fromKey = addCalendarDays(todayKey, -(Math.max(days, 1) - 1));
  return {
    since: tehranDayStartUtc(fromKey),
    until: tehranDayEndUtc(todayKey),
    fromKey,
    toKey: todayKey,
  };
}

function orderDateWhere(filters: SalesFilters = {}): Prisma.OrderWhereInput {
  const { since, until } = resolveRange(filters);
  return {
    createdAt: { gte: since, lte: until },
    status: { notIn: ['CANCELLED'] },
  };
}

async function revenueOrderIds(filters: SalesFilters = {}): Promise<string[]> {
  const orders = await prisma.order.findMany({
    where: orderDateWhere(filters),
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      paymentDetails: true,
    },
  });
  return orders.filter(isCountedRevenue).map((o) => o.id);
}

function money(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
}

export class SalesService {
  async getDailySales(date?: Date) {
    const targetKey = date ? tehranDateKey(date) : tehranDateKey(new Date());
    const from = tehranDayStartUtc(targetKey);
    const to = tehranDayEndUtc(targetKey);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        id: true,
        totalPrice: true,
        paymentMethod: true,
        paymentDetails: true,
        status: true,
        createdAt: true,
      },
    });

    const revenueOrders = orders.filter(isCountedRevenue);
    const pendingOrders = orders.filter((o) => getOrderPaymentBucket(o) === 'pending');
    const failedOrders = orders.filter((o) => getOrderPaymentBucket(o) === 'failed');

    return {
      date: targetKey,
      timezone: TEHRAN_TZ,
      orderCount: revenueOrders.length,
      totalRevenue: revenueOrders.reduce((sum, o) => sum + money(o.totalPrice), 0),
      pendingCount: pendingOrders.length,
      pendingTotal: pendingOrders.reduce((sum, o) => sum + money(o.totalPrice), 0),
      failedCount: failedOrders.length,
      failedTotal: failedOrders.reduce((sum, o) => sum + money(o.totalPrice), 0),
      orders: revenueOrders,
    };
  }

  async getTopProducts(limit = 10, filters: SalesFilters = {}) {
    const ids = await revenueOrderIds(filters);
    if (!ids.length) return [];

    const productSearch = filters.productSearch?.trim();
    const items = await prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      where: {
        orderId: { in: ids },
        ...(productSearch
          ? {
              OR: [
                { name: { contains: productSearch } },
                { product: { barcode: { contains: productSearch } } },
                { product: { name: { contains: productSearch } } },
              ],
            }
          : {}),
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        slug: true,
        image: true,
        price: true,
        discountPrice: true,
        barcode: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => ({
      productId: item.productId,
      name: item.name,
      totalQuantity: item._sum.quantity ?? 0,
      orderCount: item._count.id,
      product: productMap.get(item.productId) ?? null,
    }));
  }

  async getByPaymentMethod(filters: SalesFilters = {}) {
    const orders = await prisma.order.findMany({
      where: orderDateWhere(filters),
      select: {
        paymentMethod: true,
        totalPrice: true,
        status: true,
        paymentDetails: true,
      },
    });

    const map = new Map<PaymentMethod, { orderCount: number; totalRevenue: number }>();
    for (const order of orders) {
      if (!isCountedRevenue(order)) continue;
      const entry = map.get(order.paymentMethod) ?? { orderCount: 0, totalRevenue: 0 };
      entry.orderCount += 1;
      entry.totalRevenue += money(order.totalPrice);
      map.set(order.paymentMethod, entry);
    }

    return [...map.entries()].map(([paymentMethod, data]) => ({
      paymentMethod,
      orderCount: data.orderCount,
      totalRevenue: data.totalRevenue,
    }));
  }

  async getChartData(filters: SalesFilters = {}) {
    const productSearch = filters.productSearch?.trim();
    const range = resolveRange(filters);
    const orders = await prisma.order.findMany({
      where: {
        ...orderDateWhere(filters),
        ...(productSearch
          ? {
              items: {
                some: {
                  OR: [
                    { name: { contains: productSearch } },
                    { product: { barcode: { contains: productSearch } } },
                    { product: { name: { contains: productSearch } } },
                  ],
                },
              },
            }
          : {}),
      },
      select: {
        createdAt: true,
        totalPrice: true,
        paymentMethod: true,
        paymentDetails: true,
        status: true,
        userId: true,
        customerPhone: true,
        items: productSearch
          ? {
              where: {
                OR: [
                  { name: { contains: productSearch } },
                  { product: { barcode: { contains: productSearch } } },
                  { product: { name: { contains: productSearch } } },
                ],
              },
              select: { quantity: true, price: true, name: true },
            }
          : false,
      },
      orderBy: { createdAt: 'asc' },
    });

    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    // Fill every Tehran day in range so gaps show as zero
    for (let key = range.fromKey; ; key = addCalendarDays(key, 1)) {
      dailyMap.set(key, { date: key, revenue: 0, orders: 0 });
      if (key >= range.toKey) break;
    }

    const paymentMap = new Map<string, number>();
    const customerKeys = new Set<string>();
    let pendingTotal = 0;
    let pendingCount = 0;
    let failedTotal = 0;
    let failedCount = 0;

    for (const order of orders) {
      const bucket = getOrderPaymentBucket(order);
      const amount = money(order.totalPrice);

      if (bucket === 'pending') {
        pendingCount += 1;
        pendingTotal += amount;
        continue;
      }
      if (bucket === 'failed') {
        failedCount += 1;
        failedTotal += amount;
        continue;
      }
      if (!isCountedRevenue(order)) continue;

      const dateKey = tehranDateKey(order.createdAt);
      const entry = dailyMap.get(dateKey) ?? { date: dateKey, revenue: 0, orders: 0 };

      let revenue = amount;
      if (productSearch && Array.isArray(order.items)) {
        revenue = order.items.reduce((sum, item) => sum + money(item.price) * item.quantity, 0);
      }

      entry.revenue += revenue;
      entry.orders += 1;
      dailyMap.set(dateKey, entry);

      paymentMap.set(order.paymentMethod, (paymentMap.get(order.paymentMethod) ?? 0) + revenue);
      customerKeys.add(order.userId || order.customerPhone);
    }

    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const workingDays = daily.filter((day) => !isTehranFriday(day.date));

    return {
      daily,
      workingDays,
      uniqueCustomers: customerKeys.size,
      pendingTotal,
      pendingCount,
      failedTotal,
      failedCount,
      timezone: TEHRAN_TZ,
      range: { from: range.fromKey, to: range.toKey },
      paymentBreakdown: [...paymentMap.entries()].map(([paymentMethod, revenue]) => ({
        paymentMethod,
        revenue,
      })),
    };
  }

  async getTransactions(filters: SalesFilters = {}, page = 1, limit = 20) {
    const productSearch = filters.productSearch?.trim();
    const bucket = filters.paymentBucket || 'all';
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const itemSearchWhere = productSearch
      ? {
          OR: [
            { name: { contains: productSearch } },
            { product: { barcode: { contains: productSearch } } },
            { product: { name: { contains: productSearch } } },
          ],
        }
      : undefined;

    const where: Prisma.OrderWhereInput = {
      ...orderDateWhere(filters),
      ...(itemSearchWhere ? { items: { some: itemSearchWhere } } : {}),
    };

    // Light pass: filter payment bucket accurately, then page
    const candidates = await prisma.order.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        paymentDetails: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const matched = candidates.filter((order) => {
      if (bucket === 'paid') return isCountedRevenue(order);
      if (bucket === 'pending') return getOrderPaymentBucket(order) === 'pending';
      if (bucket === 'failed') return getOrderPaymentBucket(order) === 'failed';
      return true;
    });

    const total = matched.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    const safePage = Math.min(pageNum, totalPages);
    const pageIds = matched
      .slice((safePage - 1) * pageSize, safePage * pageSize)
      .map((o) => o.id);

    const orders = pageIds.length
      ? await prisma.order.findMany({
          where: { id: { in: pageIds } },
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            totalPrice: true,
            customerName: true,
            customerPhone: true,
            status: true,
            paymentMethod: true,
            paymentDetails: true,
            items: {
              where: itemSearchWhere,
              select: {
                name: true,
                quantity: true,
                price: true,
                product: { select: { barcode: true } },
              },
            },
          },
        })
      : [];

    const byId = new Map(orders.map((o) => [o.id, o]));

    const items = pageIds
      .map((id) => byId.get(id))
      .filter((order): order is NonNullable<typeof order> => Boolean(order))
      .map((order) => {
        const lineItems = order.items.map((item) => {
          const code = item.product?.barcode?.trim() || null;
          const lineTotal = money(item.price) * item.quantity;
          return {
            name: item.name,
            code,
            quantity: item.quantity,
            unitPrice: money(item.price),
            lineTotal,
          };
        });

        const itemsTotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
        const codes = lineItems
          .map((item) => item.code)
          .filter((code): code is string => Boolean(code));
        const paymentBucket = getOrderPaymentBucket(order);
        const details = paymentDetailsOf(order);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          tehranDate: tehranDateKey(order.createdAt),
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentBucket,
          countedInRevenue: isCountedRevenue(order),
          zibalRef: details?.refNumber ? String(details.refNumber) : null,
          totalPrice: productSearch ? itemsTotal : money(order.totalPrice),
          clothingCodes: codes.length ? codes.join('، ') : '—',
          itemsSummary: lineItems
            .map((item) => {
              const label = item.code ? `${item.code}` : item.name;
              return `${label} × ${item.quantity}`;
            })
            .join(' | '),
          items: lineItems,
        };
      });

    const pageSum = items.reduce((sum, t) => sum + t.totalPrice, 0);

    return {
      items,
      pagination: {
        page: safePage,
        limit: pageSize,
        total,
        totalPages,
      },
      pageSum,
    };
  }

  async getOverview(filters: SalesFilters = {}) {
    const days = filters.days ?? 30;
    const range = resolveRange(filters);
    const [today, topProducts, byPayment, chart, monthly] = await Promise.all([
      this.getDailySales(),
      this.getTopProducts(10, filters),
      this.getByPaymentMethod(filters),
      this.getChartData(filters),
      this.getMonthlyComparison(6),
    ]);

    const totalRevenue = chart.daily.reduce((sum, d) => sum + d.revenue, 0);
    const orderCount = chart.daily.reduce((sum, d) => sum + d.orders, 0);
    const uniqueCustomers = chart.uniqueCustomers || 0;
    const pendingTotal = chart.pendingTotal || 0;
    const pendingCount = chart.pendingCount || 0;
    const failedTotal = chart.failedTotal || 0;
    const failedCount = chart.failedCount || 0;

    return {
      totalRevenue,
      orderCount,
      pendingTotal,
      pendingCount,
      failedTotal,
      failedCount,
      avgOrder: orderCount ? Math.round(totalRevenue / orderCount) : 0,
      avgPerCustomer: uniqueCustomers ? Math.round(totalRevenue / uniqueCustomers) : 0,
      uniqueCustomers,
      daily: chart.daily,
      workingDays: chart.workingDays,
      byPayment,
      topProducts,
      monthly,
      chart,
      today,
      timezone: TEHRAN_TZ,
      range: { from: range.fromKey, to: range.toKey },
      filters: {
        days,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        productSearch: filters.productSearch ?? null,
      },
    };
  }

  async getMonthlyComparison(months = 6) {
    const todayKey = tehranDateKey(new Date());
    const [y, m] = todayKey.split('-').map(Number);
    const startMonth = m - (months - 1);
    const startY = y + Math.floor((startMonth - 1) / 12);
    const startM = ((startMonth - 1) % 12 + 12) % 12 + 1;
    const fromKey = `${startY}-${String(startM).padStart(2, '0')}-01`;
    const since = tehranDayStartUtc(fromKey);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } },
      select: {
        createdAt: true,
        totalPrice: true,
        status: true,
        paymentMethod: true,
        paymentDetails: true,
      },
    });

    const monthMap = new Map<string, { month: string; revenue: number; orders: number }>();
    for (const order of orders) {
      if (!isCountedRevenue(order)) continue;
      const key = tehranMonthKey(order.createdAt);
      const entry = monthMap.get(key) ?? { month: key, revenue: 0, orders: 0 };
      entry.revenue += money(order.totalPrice);
      entry.orders += 1;
      monthMap.set(key, entry);
    }

    const monthly = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
    const current = monthly[monthly.length - 1];
    const previous = monthly[monthly.length - 2];
    const changePercent =
      previous && previous.revenue
        ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100)
        : null;

    return { monthly, changePercent, current, previous, timezone: TEHRAN_TZ };
  }
}

export const salesService = new SalesService();
