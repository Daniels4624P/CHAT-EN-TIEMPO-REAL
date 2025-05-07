const jwt = require('jsonwebtoken')
const config = require('../config/config')

const generateAccessToken = (payload) => {
    return jwt.sign(payload, config.secretAccessToken, { expiresIn: 60 * 15 })
}

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, config.secretRefreshToken, { expiresIn: 60 * 60 * 24 * 7 })
}

module.exports = { generateAccessToken, generateRefreshToken }