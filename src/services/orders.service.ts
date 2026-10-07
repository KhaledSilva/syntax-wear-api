import { prisma } from "../utils/prisma";

const orderDetails = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
        },
      },
    },
  },
};

type OrderAccess = {
  userId: number;
  isAdmin: boolean;
};

export const getOrders = ({ userId, isAdmin }: OrderAccess) =>
  prisma.order.findMany({
    where: isAdmin ? {} : { userId },
    include: orderDetails,
    orderBy: { createdAt: "desc" },
  });

export const getOrderById = (id: number, { userId, isAdmin }: OrderAccess) =>
  prisma.order.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { userId }),
    },
    include: orderDetails,
  });
