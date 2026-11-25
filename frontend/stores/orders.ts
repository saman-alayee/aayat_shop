import { defineStore } from 'pinia';
import type { Order } from '~/types';

export type ShipRequestOrder = Order & { requestedShipDate?: string | null };

export const useOrdersStore = defineStore('orders', {
  state: () => ({
    totalCount: 0,
    heldOrders: [] as Order[],
    shipRequestOrders: [] as ShipRequestOrder[],
    heldLoading: false,
    requestingShip: false,
    shipMessage: '',
    shipError: '',
  }),

  getters: {
    heldCount: (state) => state.heldOrders.length,
    hasHeld: (state) => state.heldOrders.length > 0,
    hasShipRequests: (state) => state.shipRequestOrders.length > 0,
    /** All paid clothes waiting for one ship request (old + newly bought). */
    heldItems: (state) =>
      state.heldOrders.flatMap((order) =>
        (order.items || []).map((item) => ({
          ...item,
          orderId: order.id,
          orderNumber: order.orderNumber,
          purchasedAt: order.createdAt,
        }))
      ),
    heldItemCount: (state) =>
      state.heldOrders.reduce(
        (sum, order) => sum + (order.items || []).reduce((n, item) => n + item.quantity, 0),
        0
      ),
    /** Clothes already in an active ship request (PREPARING). */
    shipRequestItems: (state) =>
      state.shipRequestOrders.flatMap((order) =>
        (order.items || []).map((item) => ({
          ...item,
          orderId: order.id,
          orderNumber: order.orderNumber,
          purchasedAt: order.createdAt,
        }))
      ),
    shipRequestItemCount: (state) =>
      state.shipRequestOrders.reduce(
        (sum, order) => sum + (order.items || []).reduce((n, item) => n + item.quantity, 0),
        0
      ),
    /** One date for the whole active ship-request batch. */
    activeShipRequestDate: (state) => {
      const dates = state.shipRequestOrders
        .map((order) => {
          if (order.requestedShipDate) return order.requestedShipDate;
          const fromDetails = order.paymentDetails?.requestedShipDate;
          return typeof fromDetails === 'string' ? fromDetails : null;
        })
        .filter((value): value is string => Boolean(value))
        .sort();
      return dates[dates.length - 1] ?? null;
    },
    /** Soonest remaining days among held orders (for countdown UI). */
    shipRequestDaysLeft: (state) => {
      const values = state.heldOrders
        .map((order) => order.shipRequestDaysLeft)
        .filter((days): days is number => typeof days === 'number');
      if (!values.length) return null;
      return Math.min(...values);
    },
    shipRequestDeadlineDays: (state) => {
      const first = state.heldOrders.find((order) => order.shipRequestDeadlineDays != null);
      return first?.shipRequestDeadlineDays ?? null;
    },
    /** Earliest deadline date for the whole ship basket. */
    shipRequestDeadlineAt: (state) => {
      const dates = state.heldOrders
        .map((order) => order.shipRequestDeadlineAt)
        .filter((value): value is string => Boolean(value))
        .sort();
      return dates[0] ?? null;
    },
  },

  actions: {
    async fetchCount() {
      const authStore = useAuthStore();
      if (!authStore.isLoggedIn) {
        this.totalCount = 0;
        return;
      }

      try {
        const api = useApi();
        const { data } = await api.get<{ pagination: { total: number } }>('/orders?limit=1');
        this.totalCount = data.pagination?.total ?? 0;
      } catch {
        this.totalCount = 0;
      }
    },

    async fetchHeld() {
      const authStore = useAuthStore();
      authStore.init();
      if (!authStore.isLoggedIn) {
        this.heldOrders = [];
        this.shipRequestOrders = [];
        return;
      }

      this.heldLoading = true;
      try {
        const api = useApi();
        const [heldRes, shipRes] = await Promise.all([
          api.get<Order[]>('/orders/held'),
          api.get<ShipRequestOrder[]>('/orders/ship-requests').catch(() => ({ data: [] as ShipRequestOrder[] })),
        ]);
        this.heldOrders = heldRes.data;
        this.shipRequestOrders = shipRes.data;
      } catch {
        this.heldOrders = [];
        this.shipRequestOrders = [];
      } finally {
        this.heldLoading = false;
      }
    },

    async requestShipment() {
      if (this.requestingShip || !this.heldOrders.length) return false;
      const { toPersianDigits } = useFormat();
      this.requestingShip = true;
      this.shipError = '';
      this.shipMessage = '';
      try {
        const api = useApi();
        const { data } = await api.post<{ count: number; requestedShipDate?: string }>('/orders/request-shipment', {});
        this.heldOrders = [];
        this.shipMessage =
          data.count > 1
            ? `درخواست ارسال برای ${toPersianDigits(data.count)} سفارش ثبت شد.`
            : 'درخواست ارسال ثبت شد. لباس‌ها در حال آماده‌سازی هستند.';
        await Promise.all([this.fetchCount(), this.fetchHeld()]);
        return true;
      } catch (e: unknown) {
        this.shipError = e instanceof Error ? e.message : 'ثبت درخواست ارسال انجام نشد';
        return false;
      } finally {
        this.requestingShip = false;
      }
    },
  },
});
