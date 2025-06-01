import cookie from "cookie"
import AppError from "./utils/appError.js"
import jwt from "jsonwebtoken"
import config from "./config/config.js"
import * as chatService from "./services/chatService.js"
import { findUserIdByUsername, getUser } from "./services/authService.js"

const initializeSocket = (io) => {
    io.use((socket, next) => {
        const cookieString = socket.handshake.headers.cookie
        if (!cookieString) {
            return next(new AppError('El usuario no esta autenticado', 401))
        }
        const parsedCookies = cookie.parse(cookieString)
        const token = parsedCookies.accessToken
        if (!token) {
            return next(new AppError('El usuario no esta autenticado', 401))
        }
        try {
            const payload = jwt.verify(token, config.jwtSecretAccess)
            socket.user = payload
            next()
        } catch (err) {
            return next(new AppError('No se pudo autenticar el usuario', 401))
        }
    })
    
    const users = new Map()

    io.on('connection', async (socket) => {
        socket.connectedRoom = ""
        console.log('Usuario conectado')
        users.set(socket.user.username, socket.id)
        socket.emit('allChats', await chatService.getAllChats(socket.user.id))
        socket.emit('allGroups', await chatService.getAllGroups(socket.user.id))

        socket.on('typingChat', (usernameReceiver) => {
            const userReceiverId = users.get(usernameReceiver)
            socket.to(userReceiverId).emit('typingChat', `${usernameReceiver} esta escribiendo`)
        })
        socket.on('joinChat', async (chatId, limit, offset) => {
            try {
                const chatExists = await chatService.verifyChatExists(chatId, socket.user.id)
                if (!chatExists) {
                    throw new AppError('El chat no existe', 404)
                }
                const messagesChat = await chatService.getMessagesChat(chatId, limit, offset)
                socket.emit('messagesChat', messagesChat)
            } catch (err) {
                socket.emit('error_message', {
                    message: err.message || 'Internal Server Error'
                })
            }
        })
        socket.on('createChat', async (data) => {
            try {
                const chatData = {
                    user1: socket.user.id,
                    user2: data.user2
                }
                const user2Id = users.get(chatData.user2)
                const newChat = await chatService.createChat(chatData)
                io.to(user2Id).emit('createChat', newChat)
                socket.emit('createChat', newChat)
            } catch (err) {
                socket.emit('error_message', {
                    message: err.message || 'Internal Server Error'
                })
            }
        })
        socket.on('sendMessageChat', async (msg, chatId, usernameReceiver) => {
            try {
                const messageData = { 
                    message: msg, 
                    userId: socket.user.id, 
                    chatId, 
                    usernameReceiver 
                }
                const newMessage = await chatService.sendMessageChat(messageData)
                const socketIdReceiver = users.get(usernameReceiver)
                if (!socketIdReceiver) {
                    throw new AppError('El usuario no esta autenticado', 401)
                }
                const date = new Date()
                if (socket.connected) {
                    io.to(socketIdReceiver).emit('sendMessageChat', { message: msg, date, usernameReceiver, usernameSender: socket.user.username })
                }
            } catch (err) {
                socket.emit('error_message', {
                    message: err.message || 'Internal Server Error'
                })
            }
        })
        socket.on('joinGroup', async (groupId, limit, offset) => {
            try {
                const messagesGroup = await chatService.getMessagesGroups(groupId, limit, offset)
                socket.connectedRoom = groupId
                socket.join(groupId)
                socket.emit('messagesGroup', messagesGroup)
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('leaveGroupForMoment', async () => {
            try {
                socket.leave(socket.connectedRoom)
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('sendMessageGroup', async (groupId, message, sender) => {
            try {
                const data = {
                    groupId,
                    message,
                    sender
                }
                const newMessage = await chatService.sendMessageGroup(data)
                const date = new Date()
                io.to(socket.connectedRoom).emit('sendMessageGroup', { message, date, usernameSender: socket.user.username })
            } catch (error) {
                socket.emit('error_message',  {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('createGroup', async (nameGroup) => {
            try {
                const group = await chatService.createGroup(nameGroup)
                await chatService.inviteUsersToGroup(socket.user.id, group.groupId)
                socket.emit('createGroup', group)
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('inviteGroup', async (usersList, groupId) => {
            try {
                for (let i = 0; i < usersList.length; i++) {
                    const user = usersList[i]
                    const userInformation = await findUserIdByUsername(user)
                    const group = await chatService.inviteUsersToGroup(userInformation.id, groupId)
                    const userSocketId = users.get(user)
                    if (!userSocketId.connected) {
                        socket.emit('error_message', {
                            message: 'El usuario no esta conectado'
                        })
                    }
                    socket.to(userSocketId).emit('inviteGroup', { username: user,  groupId})
                }
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('typingGroup', async () => {
            socket.broadcast.to(socket.connectedRoom).emit('typingGroup', `${socket.user.username} esta escribiendo`)
        })
        socket.on('allGroups', async () => {
            socket.emit('allGroups', await chatService.getAllGroups(socket.user.id))
        })
        socket.on('allChats', async () => {
            socket.emit('allChats', await chatService.getAllChats(socket.user.id))
        })
        socket.on('disconnect', () => {
            console.log('Usuario desconectado')
            socket.leave(socket.connectedRoom)
            users.delete(socket.user.username)
        })    
    })
}

export default initializeSocket