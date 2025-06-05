import express from 'express'
import * as authController from '../../controllers/authController.js'
import { verifyToken } from '../../middlewares/authHandler.js'
import { generalLimiter, authLimiter } from '../../utils/rateLimiter.js';

const router = express.Router()

router.post('/register', authLimiter, authController.register)
router.post('/login', authLimiter, authController.login)
router.delete('/logout', verifyToken, authController.logout)
router.post('/refresh', authController.refresh)
router.get('/me', generalLimiter, verifyToken, authController.me)

export default router