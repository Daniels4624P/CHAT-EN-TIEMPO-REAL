import { createClient } from "redis";
import config from "../config/config.js";

const client = createClient({
    username: config.redisUsername,
    password: config.redisPassword,
    socket: {
        host: config.redisHost,
        port: config.redisPort
    }
})

client.on('error', () => {
    console.log('No se pudo conectar con redis')
})

await client.connect()

export default client