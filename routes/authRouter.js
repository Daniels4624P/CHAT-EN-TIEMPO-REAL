const AuthService = require('./../services/AuthService')
const Service = new AuthService()
const express = require('express')
const router = express.Router()
const authHandler = require('../middlewares/authHandler')

router.post('/register', async (req, res, next) => {
    try {
        const user = req.body
        const result = await Service.register(user)
        return res.json(result)
    } catch (err) {
        next(err)
    }
})

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body
        const { accessToken, refreshToken } = await Service.login(email, password)
        return res.cookie('accessToken', accessToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: false,
            maxAge: 1000 * 60 * 15
        }).cookie('refreshToken', refreshToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 7
        }).json(accessToken)
    } catch (err) {
        next(err)
    }
})

router.post('/logout', async (req, res, next) => {
    try {
        const token = req.cookies.refreshToken
        const logout = await Service.logout(token)
        return res.clearCookie('accessToken').clearCookie('refreshToken').json(logout)
    } catch (err) {
        next(err)
    }
})

router.get('/me', authHandler, async (req, res, next) => {
    try {
        const id = req.user.userId
        const user = await Service.getUser(id)
        return res.json(user)
    } catch (err) {
        next(err)
    }
})

router.post('/refresh', async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken
        const result = await Service.refresh(refreshToken)
        return res.cookie('accessToken', result.newAccessToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: false,
            maxAge: 1000 * 60 * 15
        }).cookie('refreshToken', result.newRefreshToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 7
        }).json(result)
    } catch (err) {
        next(err)
    }
})

module.exports = router