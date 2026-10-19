import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import AuthService from '../../core/auth/auth.service';
import { body, validationResult } from 'express-validator';

export const authRoutes = Router();

const validateRegister = [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
];

const validateLogin = [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

authRoutes.post('/register', validateRegister, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

authRoutes.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const result = await AuthService.login(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message });
  }
});

authRoutes.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});
