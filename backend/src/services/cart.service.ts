import prisma from '../config/database';
import { AppError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { settingsService } from './settings.service';

export class CartService {
  private lastExpireAt = 0;
  private holdsCache: { at: number; map: Map<string, number> } | null = null;

  private async resolveUserId(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return user ? userId : undefined;
  }

  private async getOrCreateCart(userId?: string, sessionId?: string) {
    const validUserId = await this.resolveUserId(userId);

    if (validUserId) {
      let cart = await prisma.cart.findUnique({
        where: { userId: validUserId },
        include: { items: { include: { product: true } } },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId: validUserId },
          include: { items: { include: { product: true } } },
        });
      }
      return cart;
    }

    if (sessionId) {
      let cart = await prisma.cart.findUnique({
        where: { sessionId },
        include: { items: { include: { product: true } } },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { sessionId },
          include: { items: { include: { product: true } } },
        });
      }
      return cart;
    }

    const newSessionId = uuidv4();
    const cart = await prisma.cart.create({
      data: { sessionId: newSessionId },
      include: { items: { include: { product: true } } },
    });
    return { ...cart, newSessionId };
  }

  /** Drop cart lines older than the hold window (store-wide). Throttled to cut SQLite write storms. */
  async expireAllStaleCartItems() {
    const { cartHoldMinutes } = await settingsService.getShipping();
    const now = Date.now();
    // Full sweep at most once per minute — product list traffic was expiring on every request.
    if (now - this.lastExpireAt < 60_000) {
      return cartHoldMinutes;
    }
    this.lastExpireAt = now;
    const cutoff = new Date(now - cartHoldMinutes * 60 * 1000);
    await prisma.cartItem.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });
    this.holdsCache = null;
    return cartHoldMinutes;
  }

  /**
   * Active cart quantities per product (soft reservation).
   * Optionally exclude one cart (the current shopper) so they can keep their own hold.
   */
  async getActiveHoldQuantities(excludeCartId?: string) {
    await this.expireAllStaleCartItems();
    if (!excludeCartId && this.holdsCache && Date.now() - this.holdsCache.at < 5_000) {
      return new Map(this.holdsCache.map);
    }
    const rows = await prisma.cartItem.groupBy({
      by: ['productId'],
      where: excludeCartId ? { cartId: { not: excludeCartId } } : undefined,
      _sum: { quantity: true },
    });
    const map = new Map(rows.map((row) => [row.productId, row._sum.quantity ?? 0]));
    if (!excludeCartId) {
      this.holdsCache = { at: Date.now(), map: new Map(map) };
    } else {
      this.holdsCache = null;
    }
    return map;
  }

  /** Call after cart mutations so product pages see fresh holds quickly. */
  invalidateHoldCache() {
    this.holdsCache = null;
  }

  /** When a guest logs in, move session cart lines onto the user cart. */
  private async mergeGuestCartIfNeeded(userId?: string, sessionId?: string) {
    if (!userId || !sessionId) return;
    await this.mergeCarts(userId, sessionId);
  }

  async getCart(userId?: string, sessionId?: string) {
    await this.mergeGuestCartIfNeeded(userId, sessionId);
    const cart = await this.getOrCreateCart(userId, sessionId);
    const holdMinutes = await this.expireAllStaleCartItems();
    const fresh = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });
    const formatted = this.formatCart(fresh!, holdMinutes);
    if ('newSessionId' in cart) {
      (formatted as typeof formatted & { sessionId: string }).sessionId = cart.newSessionId;
    }
    return formatted;
  }

  async addItem(userId: string | undefined, sessionId: string | undefined, productId: string, quantity = 1) {
    const product = await prisma.product.findUnique({ where: { id: productId, isActive: true } });
    if (!product) throw new AppError(404, 'محصول یافت نشد');
    if (product.stock < 1) throw new AppError(400, 'موجودی کافی نیست');

    await this.mergeGuestCartIfNeeded(userId, sessionId);
    const cart = await this.getOrCreateCart(userId, sessionId);
    const cartId = cart.id;
    this.invalidateHoldCache();
    const heldOthers = (await this.getActiveHoldQuantities(cartId)).get(productId) ?? 0;
    const available = Math.max(0, product.stock - heldOthers);

    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > available) {
        throw new AppError(
          400,
          heldOthers > 0 && available < product.stock
            ? 'این لباس انتخاب شده؛ در حال خرید است'
            : 'موجودی کافی نیست'
        );
      }
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      if (quantity > available) {
        throw new AppError(
          400,
          heldOthers > 0
            ? 'این لباس انتخاب شده؛ در حال خرید است'
            : 'موجودی کافی نیست'
        );
      }
      await prisma.cartItem.create({
        data: { cartId, productId, quantity },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    });

    const holdMinutes = (await settingsService.getShipping()).cartHoldMinutes;
    const result = this.formatCart(updatedCart!, holdMinutes);
    if ('newSessionId' in cart) {
      (result as typeof result & { sessionId: string }).sessionId = cart.newSessionId;
    }
    return result;
  }

  async updateItem(userId: string | undefined, sessionId: string | undefined, productId: string, quantity: number) {
    await this.mergeGuestCartIfNeeded(userId, sessionId);
    const cart = await this.getOrCreateCart(userId, sessionId);
    this.invalidateHoldCache();

    if (quantity <= 0) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    } else {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new AppError(404, 'محصول یافت نشد');
      const heldOthers = (await this.getActiveHoldQuantities(cart.id)).get(productId) ?? 0;
      const available = Math.max(0, product.stock - heldOthers);
      if (quantity > available) {
        throw new AppError(
          400,
          heldOthers > 0
            ? 'این لباس انتخاب شده؛ در حال خرید است'
            : 'موجودی کافی نیست'
        );
      }

      await prisma.cartItem.updateMany({
        where: { cartId: cart.id, productId },
        data: { quantity },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    const holdMinutes = (await settingsService.getShipping()).cartHoldMinutes;
    return this.formatCart(updatedCart!, holdMinutes);
  }

  async removeItem(userId: string | undefined, sessionId: string | undefined, productId: string) {
    await this.mergeGuestCartIfNeeded(userId, sessionId);
    const cart = await this.getOrCreateCart(userId, sessionId);
    this.invalidateHoldCache();
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    return this.formatCart(updatedCart!);
  }

  async clearCart(userId?: string, sessionId?: string) {
    await this.mergeGuestCartIfNeeded(userId, sessionId);
    const cart = await this.getOrCreateCart(userId, sessionId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.formatCart({ ...cart, items: [] });
  }

  async mergeCarts(userId: string, sessionId: string) {
    const sessionCart = await prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });

    if (!sessionCart || sessionCart.items.length === 0) return;
    // Already the same cart (linked to both) — nothing to merge.
    if (sessionCart.userId === userId) return;

    const userCart = await this.getOrCreateCart(userId);
    if (userCart.id === sessionCart.id) return;

    for (const item of sessionCart.items) {
      const existing = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
      });

      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + item.quantity,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: item.productId,
            quantity: item.quantity,
          },
        });
      }
    }

    await prisma.cartItem.deleteMany({ where: { cartId: sessionCart.id } });
    await prisma.cart.delete({ where: { id: sessionCart.id } }).catch(() => undefined);
  }

  private formatCart(cart: {
    id: string;
    items: Array<{
      id: string;
      quantity: number;
      updatedAt?: Date;
      product: {
        id: string;
        name: string;
        slug: string;
        price: { toNumber?: () => number } | number | bigint;
        discountPrice: { toNumber?: () => number } | number | bigint | null;
        stock: number;
        image: string | null;
        unit: string | null;
        isActive: boolean;
      };
    }>;
  }, holdMinutes = 30) {
    const items = cart.items
      .filter((item) => item.product.isActive)
      .map((item) => {
        const price = Number(item.product.price);
        const discountPrice = item.product.discountPrice ? Number(item.product.discountPrice) : null;
        const effectivePrice = discountPrice ?? price;

        return {
          id: item.id,
          productId: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          image: item.product.image,
          unit: item.product.unit,
          quantity: item.quantity,
          price,
          discountPrice,
          effectivePrice,
          subtotal: effectivePrice * item.quantity,
          stock: item.product.stock,
        };
      });

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);
    const touched = cart.items
      .map((item) => item.updatedAt)
      .filter((value): value is Date => value instanceof Date);
    const expiresAt =
      touched.length > 0
        ? new Date(Math.min(...touched.map((value) => value.getTime())) + holdMinutes * 60 * 1000).toISOString()
        : null;

    return {
      id: cart.id,
      items,
      totalItems,
      totalPrice,
      holdMinutes,
      expiresAt,
    };
  }
}

export const cartService = new CartService();
