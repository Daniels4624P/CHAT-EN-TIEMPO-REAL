import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
    windowMs: 60 * 1000 * 60,
    limit: 20,
    message: 'No puedes hacer mas peticiones',
    standardHeaders: 'draft-8',
    legacyHeaders: false
})

export const generalLimiter = rateLimit({
    windowMs: 15 * 1000 * 60,
    limit: 50,
    message: 'No puedes hacer mas peticiones',
    standardHeaders: 'draft-8',
    legacyHeaders: false
})