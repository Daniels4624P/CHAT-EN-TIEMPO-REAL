import { pool } from "../config/db.js"
import AppError from "../utils/appError.js"

export const verifyChatExists = async (chatId, userId) => {
    const chat = await pool.query('SELECT * FROM Chats WHERE id = $1 AND (user1 = $2 OR user2 = $2)', [chatId, userId])
    const foundChat = chat.rows[0]
    if (!foundChat) {
        throw new AppError('El chat no existe', 404)
    }
    return foundChat
}

export const verifyGroupExists = async (groupId, userId) => {
    const group = await pool.query(`SELECT * FROM Groups WHERE id = $1`, [groupId])
    const foundGroup = group.rows[0]
    if (!foundGroup) {
        throw new AppError('El grupo no existe', 404)
    }
    const userInGroup = await pool.query(`SELECT * FROM Groups_Users WHERE user_id = $1 AND group_id = $2`, [userId, groupId])
    const foundUserInGroup = userInGroup.rows[0]
    if (!foundUserInGroup) {
        throw new AppError('El usuario no esta en el grupo', 400)
    }
    return foundGroup
}

export const createChat = async (chatData) => {
    try {
        const user2Id = await pool.query(`SELECT * FROM Users WHERE username = $1`, [chatData.user2])
        if (!user2Id.rows[0]) {
            throw new AppError('El usuario no existe', 404)
        }
        const chat = await pool.query(`SELECT * FROM Chats WHERE (user1 = $1 OR user1 = $2) AND (user2 = $1 OR user2 = $2)`, [chatData.user1, user2Id.rows[0].id])
        if (chat.rows[0]) {
            throw new AppError('El chat ya existe', 409)
        }
        const newChat = await pool.query(`INSERT INTO Chats (name, user1, user2) VALUES ($1, $2, $3) RETURNING id`, [chatData.user2, chatData.user1, user2Id.rows[0].id])
        return { message: 'Chat creado correctamente', chatId: newChat.rows[0].id }
    } catch (err) {
        throw new AppError('El chat no se pudo crear', 500)
    }
}

export const sendMessageChat = async (data) => {
    try {
        const { message, userId, chatId, usernameReceiver } = data
        if (!message || message.length > 1000) {
            throw new AppError('El mensaje no es valido o es muy largo', 404)
        }
        const userReceiver = await pool.query(`SELECT id FROM Users WHERE username = $1`, [usernameReceiver])
        if (!userReceiver.rows[0]) {
            throw new AppError('El receptor no existe', 404);
        }
        const newMessage = await pool.query(`INSERT INTO Messages_Chats (chat_id, message, sender, receiver) VALUES ($1, $2, $3, $4)`, [chatId, message, userId, userReceiver.rows[0].id])
        return { message }
    } catch (err) {
        throw new AppError('No se pudo enviar el mensaje', 500)
    }
}

export const getAllChats = async (userId) => {
    try {
        const chats = await pool.query(`SELECT 
                c.id, 
                c.name, 
                c.user1, 
                c.user2,
                u1.username as user1_username,
                u2.username as user2_username
            FROM Chats c
            JOIN Users u1 ON c.user1 = u1.id
            JOIN Users u2 ON c.user2 = u2.id
            WHERE (c.user1 = $1 OR c.user2 = $1)`, [userId])
        if (chats.rows.length === 0) {
            return { message: 'No tienes chats actualmente' }
        }
        return chats.rows
    } catch (err) {
        throw new AppError('Hubo un error repentino', 500)
    }
}

export const getMessagesChat = async (chatId, limit, offset) => {
    const messagesChat = await pool.query(`
        SELECT m.*, u_sender.username as sender_username, u_receiver.username as receiver_username 
        FROM Messages_Chats m 
        JOIN Users u_sender ON m.sender = u_sender.id 
        JOIN Users u_receiver ON m.receiver = u_receiver.id 
        WHERE m.chat_id = $1 
        ORDER BY m.send_at ASC 
        LIMIT $2 OFFSET $3 `, [chatId, limit, offset])
    if (messagesChat.rows.length === 0) {
        return { message: 'Este chat no tiene mensajes' }
    }
    return messagesChat.rows
}

export const createGroup = async (nameGroup) => {
    try {
        if (!nameGroup || nameGroup.length > 100) {
            throw new AppError('El nombre del grupo no es valido', 400)
        }
        const newGroup = await pool.query(`INSERT INTO Groups (name) VALUES ($1) RETURNING id`, [nameGroup])
        return { message: 'Grupo creado correctamente', groupId: newGroup.rows[0].id }
    } catch (err) {
        throw new AppError('Hubo un error repentino', 500)
    } 
}

export const sendMessageGroup = async (data) => {
    try {
        const { groupId, message, sender } = data
        if (!message || message.length > 1000) {
            throw new AppError('El mensaje no es valido o es muy largo', 404)
        }
        const newMessage = await pool.query(`INSERT INTO Messages_Groups (group_id, message, sender) VALUES ($1, $2, $3)`, [groupId, message, sender])
        return { message }
    } catch (err) {
        throw new AppError('Hubo un error repentino', 500)
    }
}

export const getAllGroups = async (userId) => {
    try {
        const groups = await pool.query(`SELECT g.* FROM Groups_Users gu JOIN Groups g ON gu.group_id = g.id WHERE gu.user_id = $1`, [userId])
        if (groups.rows.length === 0) {
            return { message: 'No tienes grupos actualmente' }
        }
        return groups.rows
    } catch (err) {
        throw new AppError('Hubo un error repentino', 500)
    }
}

export const getMessagesGroups = async (groupId, limit, offset) => {
    const messages = await pool.query(`
        SELECT m.*, u.username as username FROM Messages_Groups m 
        JOIN Users u ON m.sender = u.id 
        WHERE m.group_id = $1 
        ORDER BY m.send_at ASC
        LIMIT $2 OFFSET $3`, [groupId, limit, offset])
    if (messages.rows.length === 0) {
        return { message: 'El grupo no tiene mensajes aun' }
    }
    return messages.rows
}

export const getUsersOfGroup = async (groupId) => {
    const users = await pool.query(`SELECT u.username, g.role FROM Groups_Users g JOIN Users u ON g.user_id = u.id WHERE group_id = $1`, [groupId])
    if (users.rows.length === 0) {
        return { message: 'Este grupo no tiene usuarios' }
    }
    return users.rows
}

export const inviteUsersToGroup = async (userId, groupId, role) => {
    try {
        const userInGroup = await pool.query(`SELECT * FROM Groups_Users WHERE user_id = $1 AND group_id = $2`, [userId, groupId])
        if (userInGroup.rows[0]) {
            throw new AppError('El usuario ya esta en el grupo', 409)
        }
        const newUserInGroup = await pool.query(`INSERT INTO Groups_Users (user_id, group_id, role) VALUES ($1, $2, $3)`, [userId, groupId, role])
        return { message: 'Usuario agregado correctamente', groupId }
    } catch (err) {
        throw new AppError('Hubo un error repentino', 500)
    }
}

export const editChat = async (id, newName) => {
    const chat = await pool.query(`SELECT name FROM Chats WHERE id = $1`, [id])
    const foundChat = chat.rows[0]
    if (!foundChat) {
        throw new AppError('El chat no existe', 404)
    }
    const newChat = await pool.query(`UPDATE Chats SET name = $1 WHERE id = $2`, [newName, id])
    return newChat.rows[0]
}

export const editGroup = async (id, newName) => {
    const group = await pool.query(`SELECT name FROM Groups WHERE id = $1`, [id])
    const foundGroup = group.rows[0]
    if (!foundGroup) {
        throw new AppError('El grupo no existe', 404)
    }
    await pool.query(`UPDATE Groups SET name = $1 WHERE id = $2`, [newName, id])
    return newName
}

export const editMessageChat = async (id, newMessage) => {
    const message = await pool.query(`SELECT message FROM Messages_Chats WHERE id = $1`, [id])
    const foundMessage = message.rows[0]
    if (!foundMessage) {
        throw new AppError('El mensaje no existe', 404)
    }
    await pool.query(`UPDATE Messages_Chats SET message = $1, edited = $2 WHERE id = $3`, [newMessage, true, id])
    return newMessage
}

export const editMessageGroup = async (id, newMessage) => {
    const message = await pool.query(`SELECT message FROM Messages_Groups WHERE id = $1`, [id])
    const foundMessage = message.rows[0]
    if (!foundMessage) {
        throw new AppError('El mensaje no existe', 404)
    }
    await pool.query(`UPDATE Messages_Groups SET message = $1, edited = $2 WHERE id = $3`, [newMessage, true, id])
    return newMessage
}

export const deleteMessageChat = async (id) => {
    const message = await pool.query(`SELECT message FROM Messages_Chats WHERE id = $1`, [id])
    const foundMessage = message.rows[0]
    if (!foundMessage) {
        throw new AppError('El mensaje no existe', 404)
    }
    await pool.query(`DELETE FROM Messages_Chats WHERE id = $1`, [id])
    return { message: 'El mensaje se elimino correctamente' }
}

export const deleteMessageGroup = async (id) => {
    const message = await pool.query(`SELECT message FROM Messages_Groups WHERE id = $1`, [id])
    const foundMessage = message.rows[0]
    if (!foundMessage) {
        throw new AppError('El mensaje no existe', 404)
    }
    await pool.query(`DELETE FROM Messages_Groups WHERE id = $1`, [id])
    return { message: 'El mensaje se elimino correctamente' }
}

export const deleteChat = async (chatId) => {
    const chat = await pool.query(`SELECT name FROM Chats WHERE id = $1`, [id])
    const foundChat = chat.rows[0]
    if (!foundChat) {
        throw new AppError('El chat no existe', 404)
    }
    await pool.query(`DELETE FROM Chats WHERE id = $1`, [id])
    return { message: 'El chat se elimino correctamente' }
}

export const deleteGroup = async (groupId, role) => {
    if (!role === 'Admin') {
        throw new AppError('El usuario no puede borrar el grupo', 401)
    }
    const group = await pool.query(`SELECT name FROM Groups WHERE id = $1`, [groupId])
    const foundGroup = group.rows[0]
    if (!foundGroup) {
        throw new AppError('El grupo no existe', 404)
    }
    await pool.query(`DELETE FROM Groups WHERE id = $1`, [groupId])
    return { message: 'El grupo se elimino correctamente' }
}

export const deleteUserGroup = async (userId, role, groupId) => {
    if (!role === 'Admin') {
        throw new AppError('El usuario no puede expulsar usuarios del grupo', 401)
    }
    const group = await pool.query(`SELECT name FROM Groups WHERE id = $1`, [groupId])
    const foundGroup = group.rows[0]
    if (!foundGroup) {
        throw new AppError('El grupo no existe', 404)
    }
    await pool.query(`DELETE FROM Groups_Users WHERE user_id = $1`, [userId])
    return { message: `El usuario fue expulsado por el administrador` }
}
