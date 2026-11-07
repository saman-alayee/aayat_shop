import { defineStore } from 'pinia';
import type { Order } from '~/types';

export const useOrdersStore = defineStore('orders', {
  state: () => ({
    totalCount: 0,
    heldOrders: [] as Order[],
    heldLoading: false,
    requestingShip: false,
    shipMessage: '',
    shipError: '',
  }),

  getters: {
    heldCount: (state) => state.heldOrders.length,
    hasHeld: (state) => state.heldOrders.length > 0,
    heldItems: (state) =>
      state.heldOrders.flatMap((order) =>
        (order.items || []).map((item) => ({
          ...item,
          orderNumber: order.orderNumber,
        }))
      ),
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
        return;
      }

      this.heldLoading = true;
      try {
        const api = useApi();
        const { data } = await api.get<Order[]>('/orders/held');
        this.heldOrders = data;
      } catch {
        this.heldOrders = [];
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
        const { data } = await api.post<{ count: number }>('/orders/request-shipment', {});
        this.heldOrders = [];
        this.shipMessage =
          data.count > 1
            ? `درخواست ارسال برای ${toPersianDigits(data.count)} سفارش ثبت شد.`
            : 'درخواست ارسال ثبت شد. لباس‌ها در حال آماده‌سازی هستند.';
        await this.fetchCount();
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
