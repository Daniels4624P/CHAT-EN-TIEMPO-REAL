const ApiError = require("../utils/apiError")
const jwt = require('jsonwebtoken')
const config = require('./../config/config')

const authHandler = (req, res, next) => {
    try {
        const token = req.cookies.accessToken

        if (!token) {
            throw ApiError('Unauthorized', 401)
        }

        const user = jwt.verify(token, config.secretAccessToken)

        req.user = user
        next()
    } catch (err) {
        next(err)
    }
}

module.exports = authHandler