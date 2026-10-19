import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './api/routes/auth.routes';
import { userRoutes } from './api/routes/user.routes';
import { walletRoutes } from './api/routes/wallet.routes';
import { investmentRoutes } from './api/routes/investment.routes';
import { withdrawalRoutes } from './api/routes/withdrawal.routes';
import { profitRoutes } from './api/routes/profit.routes';
import { adminRoutes } from './api/routes/admin.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/investments', investmentRoutes);
app.use('/api/v1/withdrawals', withdrawalRoutes);
app.use('/api/v1/profits', profitRoutes);
app.use('/api/v1/admin', adminRoutes);

// Error handling
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

export default server;
