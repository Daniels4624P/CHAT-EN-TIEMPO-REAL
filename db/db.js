const { createClient } = require('@libsql/client')
const config = require('../config/config')

const db = createClient({
    url: 'libsql://resolved-black-bolt-capibara50.aws-us-east-1.turso.io',
    authToken: config.dbToken
})

const migrations = async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY NOT NULL,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE
        )`)

    await db.execute(`CREATE TABLE IF NOT EXISTS Auth (
            id INTEGER PRIMARY KEY NOT NULL,
            user_id INTEGER NOT NULL,
            password TEXT NOT NULL,
            refresh_token TEXT,
            recovery_token TEXT,
            FOREIGN KEY (user_id) REFERENCES Users(id)
        )`)

    await db.execute(`CREATE TABLE IF NOT EXISTS Groups (
            id INTEGER PRIMARY KEY NOT NULL,
            name TEXT NOT NULL
        )`)

    await db.execute(`CREATE TABLE IF NOT EXISTS Private_Conversations (
            id INTEGER PRIMARY KEY NOT NULL,
            user1_id INTEGER NOT NULL,
            user2_id INTEGER NOT NULL,
            last_message_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user1_id, user2_id),
            FOREIGN KEY (user1_id) REFERENCES Users(id),
            FOREIGN KEY (user2_id) REFERENCES Users(id)
        )`)

    await db.execute(`CREATE TABLE IF NOT EXISTS Messages (
            id INTEGER PRIMARY KEY NOT NULL,
            date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            content TEXT NOT NULL,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER,
            group_id INTEGER,
            status_message TEXT CHECK(status_message IN ('pendiente', 'leido', 'sin enviar')) NOT NULL DEFAULT 'pendiente',
            conversation_id INTEGER NOT NULL,
            FOREIGN KEY (sender_id) REFERENCES Users(id),
            FOREIGN KEY (receiver_id) REFERENCES Users(id),
            FOREIGN KEY (group_id) REFERENCES Groups(id)
            FOREIGN KEY (conversation_id) REFERENCES Private_Conversations(id)
        )`)

    await db.execute(`CREATE TABLE IF NOT EXISTS Groups_Users (
        id INTEGER PRIMARY KEY NOT NULL,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        role TEXT CHECK(role IN ('admin', 'user')) NOT NULL,
        UNIQUE (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES Groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
    )`)
}

module.exports = {
    db,
    migrations
}