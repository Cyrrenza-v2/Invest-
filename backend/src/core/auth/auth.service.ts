import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

export class AuthService {
  async register(payload: RegisterPayload) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: payload.email },
      });

      if (existingUser) {
        throw new Error('User already exists');
      }

      const hashedPassword = await bcrypt.hash(payload.password, 10);
      const userId = uuidv4();

      const user = await prisma.user.create({
        data: {
          id: userId,
          email: payload.email,
          password: hashedPassword,
          name: payload.name,
          phone: payload.phone,
          role: 'USER',
          kycStatus: 'PENDING',
        },
      });

      // Create wallet for user
      await prisma.wallet.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          balance: 0,
          status: 'ACTIVE',
        },
      });

      logger.info(`User registered: ${user.email}`);

      return {
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  async login(payload: LoginPayload) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(payload.password, user.password);

      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
      );

      logger.info(`User logged in: ${user.email}`);

      return {
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }
}

export default new AuthService();
