const bcrypt = require('bcrypt')
const { db } = require('../db/db')
const { generateAccessToken, generateRefreshToken } = require('../utils/generateTokens')
const ApiError = require('../utils/apiError')
const config = require('../config/config')
const jwt = require('jsonwebtoken')

class AuthService {

    async register(newUser) {
        const { password } = newUser

        const hashPassword = await bcrypt.hash(password, 10)
        const user = {
            ...newUser,
            password: hashPassword
        }

        let result = await db.execute(`SELECT * FROM Users WHERE email = $1 OR username = $2`, [user.email, user.username])

        if (result.rows.length) {
            throw new ApiError('The email or username already exists', 404)
        }

        let resultUsers = await db.execute({ 
            sql: `INSERT INTO Users (username, email) VALUES (:username, :email) RETURNING id`,
            args: { username: user.username, email: user.email }
        })

        const userId = resultUsers.rows[0].id

        let resultAuth = await db.execute({ 
            sql: `INSERT INTO Auth (user_id, password) VALUES (:userId, :password)`,
            args: { userId, password: user.password }
        })

        return {message: 'El usuario se creo correctamente', result: resultAuth }

    }

    async login(email, password) {
        let resultUser = await db.execute(`SELECT * FROM Users WHERE email = $1`, [ email ])
        
        if (!resultUser.rows.length) {
            throw new ApiError('Authentication info not Found', 404)
        }

        const user = resultUser.rows[0]

        let resultAuth = await db.execute(`SELECT * FROM Auth WHERE user_id = $1`, [ user.id ])

        if (!resultAuth.rows.length) {
            throw new ApiError('Authentication info not Found', 404)
        }
        
        const storedPassword = resultAuth.rows[0]?.password

        const match = await bcrypt.compare(password, storedPassword)

        if (!match) {
            throw new ApiError('Unauthorized', 401)
        }

        const accessToken = generateAccessToken({ userId: user.id, username: user.username })
        const refreshToken = generateRefreshToken({ userId: user.id, username: user.username })

        let result = await db.execute(`UPDATE Auth SET refresh_token = $1 WHERE user_id = $2`, [ refreshToken, user.id ])

        return { accessToken, refreshToken }

    }

    async logout(token) {
        const user = await db.execute(`UPDATE Auth SET refresh_token = null WHERE refresh_token = $1`, [token])

        if (!user.rowsAffected === 0) {
            throw new ApiError('The user does not exist or is already logged out', 404)
        }

        return { message: 'logout succesful' }
    }

    async getUser(id) {
        const user = await db.execute(`SELECT * FROM Users WHERE id = $1`, [id])

        if (!user.rows.length) {
            throw new ApiError('User doesnt exists', 400)
        }

        return user.rows[0]
    }

    async refresh(refreshToken) {
        if (!refreshToken) {
            throw new ApiError('Token not exists', 401)
        }

        const userData = jwt.verify(refreshToken, config.secretRefreshToken)

        if (!userData) {
            throw new ApiError('Token not found', 401)
        }

        const user = await db.execute(`SELECT * FROM Auth WHERE refresh_token = $1`, [refreshToken])

        const resultUser = await db.execute(`SELECT * FROM Users WHERE id = $1`, [user.rows[0].user_id])

        if (!user.rows.length) {
            throw new ApiError('Token not found', 401)
        }

        const newAccessToken = generateAccessToken({ userId: resultUser.rows[0].id, username: resultUser.rows[0].username })
        const newRefreshToken = generateRefreshToken({ userId: resultUser.rows[0].id, username: resultUser.rows[0].username })

        const result = await db.execute(`UPDATE Auth SET refresh_token = $1 WHERE user_id = $2`, [newRefreshToken, user.rows[0].user_id])

        console.log(result.rows[0])

        return { newAccessToken, newRefreshToken }
    }

}

module.exports = AuthService