import dotenv from 'dotenv'
dotenv.config()

const config = {
    port: process.env.PORT,
    dbUrl: process.env.DB_URL,
    jwtSecretAccess: process.env.JWT_SECRET_ACCESS,
    jwtSecretRefresh: process.env.JWT_SECRET_ACCESS,
    environment: process.env.ENVIRONMENT,
    redisPort: process.env.REDIS_PORT,
    redisUsername: process.env.REDIS_USERNAME,
    redisPassword: process.env.REDIS_PASSWORD,
    redisHost: process.env.REDIS_HOST
}

export default config