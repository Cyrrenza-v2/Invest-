import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import prisma from '../../config/database';
import LedgerService from '../../core/ledger/ledger.service';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const investmentRoutes = Router();

investmentRoutes.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.investmentPlan.findMany({
      where: { active: true },
    });
    res.json({ success: true, plans });
  } catch (error: any) {
    logger.error('Get plans error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

investmentRoutes.post('/invest', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { planId, amount } = req.body;

    const balance = await LedgerService.getUserBalance(req.user?.id!);
    if (balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const plan = await prisma.investmentPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const investmentId = uuidv4();
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + plan.durationDays);

    const investment = await prisma.investment.create({
      data: {
        id: investmentId,
        userId: req.user?.id!,
        planId,
        amount,
        status: 'ACTIVE',
        startDate: new Date(),
        maturityDate,
      },
    });

    // Debit wallet
    await LedgerService.updateBalance(req.user?.id!, -amount);

    // Create ledger entry
    await LedgerService.createEntry({
      userId: req.user?.id!,
      type: 'INVESTMENT_DEBIT',
      amount,
      description: `Investment in ${plan.name}`,
      referenceId: investmentId,
      status: 'COMPLETED',
    });

    res.json({
      success: true,
      message: 'Investment created successfully',
      investment,
    });
  } catch (error: any) {
    logger.error('Investment error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

investmentRoutes.get('/my-investments', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const investments = await prisma.investment.findMany({
      where: { userId: req.user?.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, investments });
  } catch (error: any) {
    logger.error('Get investments error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
