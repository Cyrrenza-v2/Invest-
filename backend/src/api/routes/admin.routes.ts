import { Router } from 'express';
import { authMiddleware, AdminOnly, adminOnly } from '../../middleware/auth';
import prisma from '../../config/database';
import logger from '../../utils/logger';

export const adminRoutes = Router();

adminRoutes.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalInvestments = await prisma.investment.count();
    const totalDeposits = await prisma.deposit.count();
    const totalWithdrawals = await prisma.withdrawal.count();

    const deposits = await prisma.deposit.aggregate({
      _sum: { amount: true },
    });

    const withdrawals = await prisma.withdrawal.aggregate({
      _sum: { amount: true },
    });

    const investments = await prisma.investment.aggregate({
      _sum: { amount: true },
    });

    res.json({
      success: true,
      dashboard: {
        totalUsers,
        totalInvestments,
        totalDeposits,
        totalWithdrawals,
        totalDepositAmount: deposits._sum.amount || 0,
        totalWithdrawalAmount: withdrawals._sum.amount || 0,
        totalInvestmentAmount: investments._sum.amount || 0,
      },
    });
  } catch (error: any) {
    logger.error('Dashboard error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

adminRoutes.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        kycStatus: true,
        createdAt: true,
        wallet: { select: { balance: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, users });
  } catch (error: any) {
    logger.error('Get users error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

adminRoutes.get('/users/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: {
        wallet: true,
        investments: true,
        withdrawals: true,
        profits: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    logger.error('Get user error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

adminRoutes.get('/pending-withdrawals', authMiddleware, adminOnly, async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, withdrawals });
  } catch (error: any) {
    logger.error('Get pending withdrawals error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
