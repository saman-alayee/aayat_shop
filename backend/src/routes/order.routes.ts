import { Router } from 'express';
import { z } from 'zod';
import { orderService } from '../services/order.service';
import { asyncHandler, successResponse, validate } from '../utils/errors';
import { authenticate, optionalAuth, sessionMiddleware } from '../middleware/auth';
import { paramId } from '../utils/params';

const router = Router();

const createOrderSchema = z
  .object({
    customerName: z.string().min(3, 'نام و نام خانوادگی الزامی است'),
    customerPhone: z.string().min(10, 'شماره موبایل الزامی است'),
    deliveryAddress: z.string().min(5).optional(),
    address: z.string().min(5).optional(),
    street: z.string().min(3).optional(),
    plaque: z.string().optional(),
    unit: z.string().optional(),
    province: z.string().min(2, 'استان الزامی است').optional(),
    city: z.string().min(2, 'شهر الزامی است').optional(),
    postalCode: z.string().regex(/^\d{10}$/, 'کدپستی باید ۱۰ رقم باشد').optional(),
    addressId: z.string().optional(),
    addressTitle: z.string().optional(),
    notes: z.string().optional(),
    couponCode: z.string().optional(),
    deliveryMethod: z.enum(['PICKUP', 'NATIONWIDE']),
    paymentMethod: z.literal('ZIBAL').optional(),
  })
  .refine(
    (data) =>
      Boolean(data.addressId) ||
      (Boolean(data.province?.trim()) &&
        Boolean(data.city?.trim()) &&
        Boolean(data.postalCode?.trim()) &&
        (Boolean(data.deliveryAddress?.trim()) || Boolean(data.address?.trim()) || Boolean(data.street?.trim()))),
    { message: 'استان، شهر، کدپستی و آدرس ارسال الزامی است' }
  );

router.use(sessionMiddleware);

router.post(
  '/',
  optionalAuth,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(
      req.body,
      req.user?.userId,
      req.sessionId
    );
    successResponse(res, order, 'سفارش با موفقیت ثبت شد', 201);
  })
);

router.get(
  '/track/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderByNumber(paramId(req.params.orderNumber));
    successResponse(res, order);
  })
);

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const orders = await orderService.getUserOrders(req.user!.userId, page);
    successResponse(res, orders);
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(paramId(req.params.id), req.user!.userId);
    successResponse(res, order);
  })
);

export default router;
