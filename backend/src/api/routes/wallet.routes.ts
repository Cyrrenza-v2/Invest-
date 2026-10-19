import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import prisma from '../../config/database';
import LedgerService from '../../core/ledger/ledger.service';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const walletRoutes = Router();

walletRoutes.get('/balance', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const balance = await LedgerService.getUserBalance(req.user?.id!);
    res.json({ success: true, balance });
  } catch (error: any) {
    logger.error('Get balance error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

walletRoutes.post('/deposit', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { amount, paymentMethod } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const depositId = uuidv4();

    const deposit = await prisma.deposit.create({
      data: {
        id: depositId,
        userId: req.user?.id!,
        amount,
        paymentMethod,
        status: 'PENDING',
      },
    });

    await LedgerService.createEntry({
      userId: req.user?.id!,
      type: 'DEPOSIT',
      amount,
      description: `Deposit via ${paymentMethod}`,
      referenceId: depositId,
      status: 'PENDING',
    });

    res.json({
      success: true,
      message: 'Deposit initiated',
      deposit,
    });
  } catch (error: any) {
    logger.error('Deposit error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

walletRoutes.get('/transactions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const transactions = await LedgerService.getLedgerHistory(req.user?.id!);
    res.json({ success: true, transactions });
  } catch (error: any) {
    logger.error('Get transactions error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
