import prisma from '../../config/database';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface LedgerEntry {
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PROFIT_CREDIT' | 'INVESTMENT_DEBIT';
  amount: number;
  description: string;
  referenceId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export class LedgerService {
  async createEntry(payload: LedgerEntry) {
    try {
      const entry = await prisma.ledger.create({
        data: {
          id: uuidv4(),
          userId: payload.userId,
          type: payload.type,
          amount: payload.amount,
          description: payload.description,
          referenceId: payload.referenceId,
          status: payload.status,
          timestamp: new Date(),
        },
      });

      logger.info(`Ledger entry created: ${entry.id}`);
      return entry;
    } catch (error) {
      logger.error('Ledger entry creation error:', error);
      throw error;
    }
  }

  async getUserBalance(userId: string) {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
      });

      return wallet?.balance || 0;
    } catch (error) {
      logger.error('Get balance error:', error);
      throw error;
    }
  }

  async updateBalance(userId: string, amount: number) {
    try {
      const wallet = await prisma.wallet.update({
        where: { userId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      logger.info(`Balance updated for user ${userId}: ${amount}`);
      return wallet;
    } catch (error) {
      logger.error('Update balance error:', error);
      throw error;
    }
  }

  async getLedgerHistory(userId: string, limit: number = 50) {
    try {
      const entries = await prisma.ledger.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return entries;
    } catch (error) {
      logger.error('Get ledger history error:', error);
      throw error;
    }
  }
}

export default new LedgerService();
