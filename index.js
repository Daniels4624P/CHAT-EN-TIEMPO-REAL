const express = require('express')
const morgan = require('morgan')
const { createServer } = require('http')
const websocket = require('./socket')
const config = require('./config/config')
const path = require('path')
const { migrations, db } = require('./db/db')
const routerApi = require('./routes/index')
const cookieParser = require('cookie-parser')
const errorHandler = require('./middlewares/errorHandler')

const app = express()

app.use(morgan('dev'))
app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => {
    return res.sendFile(path.join(__dirname, 'views', 'index.html'))
})

routerApi(app)

const httpServer = createServer(app)

app.use(errorHandler)

const io = websocket(httpServer)

const users = new Map()

io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error('No cookie header'));
    }

    const cookies = require('cookie').parse(cookieHeader);
    const token = cookies.accessToken;

    if (!token) {
      return next(new Error('Token not found'));
    }

    try {
      const decoded = require('jsonwebtoken').verify(token, config.secretAccessToken);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
});

io.on('connection', async (socket) => {
    try {

        console.log('el usuario esta conectado', socket.user, socket.id)
        users.set(socket.user.username, socket.id)

        if (!socket.recovered) {
            const messages = await db.execute(`SELECT Messages.*, Private_Conversations.*, u1.username AS user1_username, u2.username AS user2_username FROM Messages INNER JOIN Private_Conversations ON Private_Conversations.id = Messages.conversation_id INNER JOIN Users u1 ON u1.id = Private_Conversations.user1_id INNER JOIN Users u2 ON u2.id = Private_Conversations.user2_id WHERE (Private_Conversations.user1_id = $1 OR Private_Conversations.user2_id = $1) ORDER BY Messages.date_time ASC;`, [socket.user.userId])
            const allUsers = await db.execute(`SELECT Users.username, Private_Conversations.last_message_time FROM Private_Conversations JOIN Users ON Private_Conversations.user2_id = Users.id WHERE Private_Conversations.user1_id = $1 UNION ALL SELECT Users.username, Private_Conversations.last_message_time FROM Private_Conversations JOIN Users ON Private_Conversations.user1_id = Users.id WHERE Private_Conversations.user2_id = $1 ORDER BY last_message_time DESC`, [socket.user.userId])
            socket.emit('earrings messages', {
                conversations: messages.rows,
                users: allUsers.rows
            })
        }

        socket.on('message', async (msg, remitente) => {
            try {
                const remitenteExists = users.get(remitente)
                const result = await db.execute(`SELECT * FROM Users WHERE username = $1`, [remitente])

                if (!msg.trim()) {
                    return socket.emit('message status', {
                        status: 'error',
                        error: `No hay ningun mensaje`,
                        para: remitente
                    });
                }

                if (!result.rows.length) {
                    console.log('No se pudo enviar el mensaje')
                    return socket.emit('message status', {
                        status: 'error',
                        error: `El usuario ${remitente} no existe.`,
                        para: remitente
                    });
                } else {
                    if (!remitenteExists) {
                        const conversation = await db.execute(`SELECT * FROM Private_Conversations WHERE (user1_id = $1 AND user2_id = $2 OR user2_id = $1 AND user1_id = $2)`, [socket.user.userId, result.rows[0].id])
                        if (!conversation.rows.length) {
                            const newConversation = await db.execute({sql: `INSERT INTO Private_Conversations (user1_id, user2_id) VALUES (:user1, :user2) RETURNING id`, args: { user1: socket.user.userId, user2: result.rows[0].id }})
                            await db.execute({sql: `INSERT INTO Messages (content, sender_id, receiver_id, group_id, conversation_id) VALUES (:content, :sender_id, :receiver_id, :group_id, :conversation_id)`, args: { content: msg, sender_id: socket.user.userId, receiver_id: result.rows[0].id, group_id: null, conversation_id: newConversation.rows[0].id}})
                        }
                        await db.execute({sql: `INSERT INTO Messages (content, sender_id, receiver_id, group_id, conversation_id) VALUES (:content, :sender_id, :receiver_id, :group_id, :conversation_id)`, args: { content: msg, sender_id: socket.user.userId, receiver_id: result.rows[0].id, group_id: null, conversation_id: conversation.rows[0].id}})
                    } else {
                        const conversation = await db.execute(`SELECT * FROM Private_Conversations WHERE (user1_id = $1 AND user2_id = $2 OR user2_id = $1 AND user1_id = $2)`, [socket.user.userId, result.rows[0].id])
                        if (!conversation.rows.length) {
                            const newConversation = await db.execute({sql: `INSERT INTO Private_Conversations (user1_id, user2_id) VALUES (:user1, :user2) RETURNING id`, args: { user1: socket.user.userId, user2: result.rows[0].id }})
                            await db.execute({sql: `INSERT INTO Messages (content, sender_id, receiver_id, group_id, conversation_id) VALUES (:content, :sender_id, :receiver_id, :group_id, :conversation_id)`, args: { content: msg, sender_id: socket.user.userId, receiver_id: result.rows[0].id, group_id: null, conversation_id: newConversation.rows[0].id}})
                        } else {
                            await db.execute({sql: `INSERT INTO Messages (content, sender_id, receiver_id, group_id, conversation_id) VALUES (:content, :sender_id, :receiver_id, :group_id, :conversation_id)`, args: { content: msg, sender_id: socket.user.userId, receiver_id: result.rows[0].id, group_id: null, conversation_id: conversation.rows[0].id }})
                        }
                        socket.to(users.get(remitente)).emit('message', {
                            message: msg,
                            para: remitente,
                            de: socket.user.username,
                            date_time: new Date().toISOString()
                        })

                        socket.emit('message', {
                            message: msg,
                            para: remitente,
                            de: socket.user.username,
                            date_time: new Date().toISOString()
                        })

                        socket.emit('message status', {
                            status: 'success',
                            para: remitente,
                            message: msg
                        })
                    }
                }
            } catch (err) {
                console.log(err)
                socket.emit('message status', {
                    status: 'error',
                    message: 'Hubo un error al procesar el mensaje'
                });
            }
        })

        socket.on('getConversation', async (username) => {
            try {
                const user = await db.execute(`SELECT id FROM Users WHERE username = $1`, [username.username])
                if (!user.rows[0].id) {
                    console.log('El usuario no existe')
                    return
                }
                const meId = socket.user.userId;
                const themId = user.rows[0].id;

                const conversation = await db.execute({
                sql: `SELECT 
                    m.*, 
                    sender.username AS sender_username,
                    receiver.username AS receiver_username
                    FROM Messages m
                    JOIN Users sender ON sender.id = m.sender_id
                    JOIN Users receiver ON receiver.id = m.receiver_id
                    WHERE 
                    (m.sender_id = :me AND m.receiver_id = :them)
                    OR
                    (m.sender_id = :them AND m.receiver_id = :me)
                    ORDER BY m.date_time ASC;`,
                args: { me: meId, them: themId }
                });
                socket.emit('conversationMessages', conversation.rows)
            } catch (err) {
                console.log(err)
            }
        })

        socket.on('disconnect', () => {
            console.log(`Se desconecto ${socket.user.username}`)
            users.delete(socket.user.username)
        })
    } catch (err) {
        console.log(err)
    }
}) 

httpServer.listen(config.port, async () => {
    await migrations()
    console.log(`servidor corriendo en el puerto ${config.port}`)
})