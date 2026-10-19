import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import prisma from '../../config/database';
import logger from '../../utils/logger';

export const userRoutes = Router();

userRoutes.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        kycStatus: true,
        createdAt: true,
      },
    });

    res.json({ success: true, user });
  } catch (error: any) {
    logger.error('Get profile error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

userRoutes.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user?.id },
      data: { name, phone },
    });

    res.json({ success: true, message: 'Profile updated', user });
  } catch (error: any) {
    logger.error('Update profile error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

userRoutes.post('/kyc/submit', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { documentType, documentNumber } = req.body;

    await prisma.kyc.create({
      data: {
        userId: req.user?.id!,
        documentType,
        documentNumber,
        status: 'PENDING',
      },
    });

    await prisma.user.update({
      where: { id: req.user?.id },
      data: { kycStatus: 'PENDING_REVIEW' },
    });

    res.json({ success: true, message: 'KYC submitted for review' });
  } catch (error: any) {
    logger.error('KYC submit error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
