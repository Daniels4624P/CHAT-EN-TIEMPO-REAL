import cookie from "cookie"
import AppError from "./utils/appError.js"
import jwt from "jsonwebtoken"
import config from "./config/config.js"
import * as chatService from "./services/chatService.js"
import client from "./utils/redis.js"
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

    io.on('connection', async (socket) => {
        socket.connectedRoom = ""
        console.log('Usuario conectado')
        await client.set(`users:${socket.user.username}`, socket.id)
        socket.emit('allChats', await chatService.getAllChats(socket.user.id))
        socket.emit('allGroups', await chatService.getAllGroups(socket.user.id))

        socket.on('typingChat', async (usernameReceiver) => {
            const userReceiverId = await client.get(`users:${usernameReceiver}`)
            socket.to(userReceiverId).emit('typingChat', `${usernameReceiver} esta escribiendo`)
        })
        socket.on('joinChat', async (chatId, limit, offset) => {
            try {
                const chatExists = await chatService.verifyChatExists(chatId, socket.user.id)
                if (!chatExists) {
                    throw new AppError('El chat no existe', 404)
                }
                const messagesChat = await chatService.getMessagesChat(chatId, limit, offset)
                console.log(messagesChat)
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
                const user2Id = await client.get(`users:${chatData.user2}`)
                const newChat = await chatService.createChat(chatData)
                if (user2Id) {
                    io.to(user2Id).emit('createChat', newChat)
                }
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
                const socketIdReceiver = await client.get(`users:${usernameReceiver}`)
                const date = new Date()
                if (socketIdReceiver) {
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
                const usersGroup = await chatService.getUsersOfGroup(groupId)
                socket.connectedRoom = groupId
                socket.join(groupId)
                socket.emit('messagesGroup', messagesGroup)
                socket.emit('usersGroup', usersGroup)
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
                await chatService.inviteUsersToGroup(socket.user.id, group.groupId, 'Admin')
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
                    const group = await chatService.inviteUsersToGroup(userInformation.id, groupId, 'User')
                    const userSocketId = await client.get(`users:${user}`)
                    if (userSocketId) {
                        socket.to(userSocketId).emit('inviteGroup', { username: user,  groupId})
                    }
                }
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('editMessageChat', async (id, newMessage, usernameReceiver) => {
            try {
                const editMessage = await chatService.editMessageChat(id, newMessage)
                const socketIdReceiver = await client.get(`users:${usernameReceiver}`)
                if (socketIdReceiver) {
                    io.to(socketIdReceiver).emit('editMessageChat', editMessage)
                }
                socket.emit('editMessageChat', {
                    id: editMessage.id,
                    message: editMessage.message
                })
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }            
        })
        socket.on('editMessageGroup', async (id, newMessage) => {
            try {
                const editMessage = await chatService.editMessageGroup(id, newMessage)
                io.to(socket.connectedRoom).emit('editMessageGroup', {
                    id: editMessage.id,
                    message: editMessage.message
                })
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('deleteMessageChat', async (id, usernameReceiver) => {
            try {
                const message = await chatService.deleteMessageChat(id)
                const socketIdReceiver = await client.get(`users:${usernameReceiver}`)
                if (socketIdReceiver) {
                    io.to(socketIdReceiver).emit('deleteMessageChat', {
                        id, message
                    })
                }
                socket.emit('deleteMessageChat', {
                    id, message
                })
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('deleteMessageGroup', async (id) => {
            try {
                const message = await chatService.deleteMessageGroup(id)
                io.to(socket.connectedRoom).emit('deleteMessageGroup', {
                    id, message
                })
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('editGroup', async (id, newName) => {
            try {
                const newGroup = await chatService.editGroup(id, newName)
                io.to(socket.connectedRoom).emit('editGroup', newGroup)
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('deleteChat', async (chatId, usernameReceiver) => {
            try {
                const deleteMessage = await chatService.deleteChat(chatId)
                const socketIdReceiver = await client.get(`users${usernameReceiver}`)
                if (socketIdReceiver) {
                    io.to(socketIdReceiver).emit('deleteChat', deleteMessage)
                }
                socket.emit('deleteChat', deleteMessage)
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('deleteGroup', async (groupId, role) => {
            try {
                const deleteMessage = await chatService.deleteGroup(groupId,role)
                io.to(socket.connectedRoom).emit('deleteGroup', deleteMessage)
            } catch (error) {
                socket.emit('error_message', {
                    message: error.message || 'Internal Server Error'
                })
            }
        })
        socket.on('expelUser', async (userId, role, groupId) => {
            try {
                const expelUserMessage = await chatService.deleteUserGroup(userId, role, groupId)
                io.to(socket.connectedRoom).emit('expelUser', expelUserMessage)
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
        socket.on('disconnect', async () => {
            console.log('Usuario desconectado')
            socket.leave(socket.connectedRoom)
            await client.del(`users:${socket.user.username}`)
        })    
    })
}

export default initializeSocket