import { Router } from 'express';
import { authMiddleware, AuthRequest, adminOnly } from '../../middleware/auth';
import prisma from '../../config/database';
import LedgerService from '../../core/ledger/ledger.service';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const withdrawalRoutes = Router();

withdrawalRoutes.post('/request', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { amount, bankAccount } = req.body;

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const balance = await LedgerService.getUserBalance(req.user?.id!);
    if (balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const withdrawalId = uuidv4();

    const withdrawal = await prisma.withdrawal.create({
      data: {
        id: withdrawalId,
        userId: req.user?.id!,
        amount,
        bankAccount,
        status: 'PENDING',
      },
    });

    await LedgerService.createEntry({
      userId: req.user?.id!,
      type: 'WITHDRAWAL',
      amount,
      description: 'Withdrawal request',
      referenceId: withdrawalId,
      status: 'PENDING',
    });

    res.json({
      success: true,
      message: 'Withdrawal request created',
      withdrawal,
    });
  } catch (error: any) {
    logger.error('Withdrawal request error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

withdrawalRoutes.get('/my-requests', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: req.user?.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, withdrawals });
  } catch (error: any) {
    logger.error('Get withdrawals error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

withdrawalRoutes.post('/approve/:withdrawalId', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: req.params.withdrawalId },
    });

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    // Update withdrawal status
    const updatedWithdrawal = await prisma.withdrawal.update({
      where: { id: req.params.withdrawalId },
      data: { status: 'APPROVED' },
    });

    // Debit wallet
    await LedgerService.updateBalance(withdrawal.userId, -withdrawal.amount);

    // Create ledger entry
    await LedgerService.createEntry({
      userId: withdrawal.userId,
      type: 'WITHDRAWAL',
      amount: withdrawal.amount,
      description: 'Withdrawal approved and processed',
      referenceId: req.params.withdrawalId,
      status: 'COMPLETED',
    });

    res.json({
      success: true,
      message: 'Withdrawal approved',
      withdrawal: updatedWithdrawal,
    });
  } catch (error: any) {
    logger.error('Approve withdrawal error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

withdrawalRoutes.post('/reject/:withdrawalId', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: req.params.withdrawalId },
    });

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    const updatedWithdrawal = await prisma.withdrawal.update({
      where: { id: req.params.withdrawalId },
      data: { status: 'REJECTED' },
    });

    res.json({
      success: true,
      message: 'Withdrawal rejected',
      withdrawal: updatedWithdrawal,
    });
  } catch (error: any) {
    logger.error('Reject withdrawal error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
