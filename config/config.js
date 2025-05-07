require('dotenv').config()

const config = {
    port: process.env.PORT || 3000,
    dbToken: process.env.DB_TOKEN,
    secretAccessToken: process.env.SECRET_ACCESS_TOKEN,
    secretRefreshToken: process.env.SECRET_REFRESH_TOKEN
}

module.exports = config