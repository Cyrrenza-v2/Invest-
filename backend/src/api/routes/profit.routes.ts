import { Router } from 'express';
import { authMiddleware, AuthRequest, adminOnly } from '../../middleware/auth';
import prisma from '../../config/database';
import LedgerService from '../../core/ledger/ledger.service';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const profitRoutes = Router();

profitRoutes.get('/my-profits', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const profits = await prisma.profit.findMany({
      where: { userId: req.user?.id },
      orderBy: { createdAt: 'desc' },
    });

    const totalProfits = profits.reduce((sum, p) => sum + p.amount, 0);

    res.json({ success: true, profits, totalProfits });
  } catch (error: any) {
    logger.error('Get profits error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

profitRoutes.post('/calculate', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const investments = await prisma.investment.findMany({
      where: {
        status: 'ACTIVE',
        maturityDate: { lte: new Date() },
      },
    });

    let profitsCalculated = 0;

    for (const investment of investments) {
      const plan = await prisma.investmentPlan.findUnique({
        where: { id: investment.planId },
      });

      if (plan) {
        const profitAmount = (investment.amount * plan.returnPercentage) / 100;
        const profitId = uuidv4();

        await prisma.profit.create({
          data: {
            id: profitId,
            userId: investment.userId,
            investmentId: investment.id,
            amount: profitAmount,
            status: 'PENDING_APPROVAL',
          },
        });

        profitsCalculated++;
      }
    }

    res.json({
      success: true,
      message: `Calculated profits for ${profitsCalculated} investments`,
      count: profitsCalculated,
    });
  } catch (error: any) {
    logger.error('Calculate profits error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

profitRoutes.post('/approve/:profitId', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const profit = await prisma.profit.findUnique({
      where: { id: req.params.profitId },
    });

    if (!profit) {
      return res.status(404).json({ success: false, message: 'Profit not found' });
    }

    // Update profit status
    const updatedProfit = await prisma.profit.update({
      where: { id: req.params.profitId },
      data: { status: 'APPROVED' },
    });

    // Credit wallet
    await LedgerService.updateBalance(profit.userId, profit.amount);

    // Create ledger entry
    await LedgerService.createEntry({
      userId: profit.userId,
      type: 'PROFIT_CREDIT',
      amount: profit.amount,
      description: 'Profit credit approved',
      referenceId: req.params.profitId,
      status: 'COMPLETED',
    });

    res.json({
      success: true,
      message: 'Profit approved and credited',
      profit: updatedProfit,
    });
  } catch (error: any) {
    logger.error('Approve profit error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
