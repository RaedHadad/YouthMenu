import { adminJson, adminError } from '@/lib/admin/http';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();
    const menuItems = await prisma.menuItem.findMany({ orderBy: { createdAt: 'asc' } });
    const toppings = await prisma.topping.findMany({ orderBy: { createdAt: 'asc' } });
    return adminJson({ menuItems, toppings });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    if (body.entity === 'item') {
      const item = await prisma.menuItem.create({
        data: {
          name: body.name,
          priceInAgorot: Number(body.priceInAgorot),
          isAvailable: body.isAvailable ?? true,
        },
      });
      return adminJson({ item });
    }

    const topping = await prisma.topping.create({
      data: {
        name: body.name,
        priceInAgorot: Number(body.priceInAgorot),
        isAvailable: body.isAvailable ?? true,
      },
    });

    return adminJson({ topping });
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    if (body.entity === 'item') {
      const item = await prisma.menuItem.update({
        where: { id: body.id },
        data: {
          isAvailable: body.isAvailable,
          name: body.name,
          priceInAgorot: body.priceInAgorot,
        },
      });
      return adminJson({ item });
    }

    const topping = await prisma.topping.update({
      where: { id: body.id },
      data: {
        isAvailable: body.isAvailable,
        name: body.name,
        priceInAgorot: body.priceInAgorot,
      },
    });

    return adminJson({ topping });
  } catch (error) {
    return adminError(error);
  }
}
