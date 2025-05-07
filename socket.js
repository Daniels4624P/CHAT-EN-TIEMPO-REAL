const { Server } = require('socket.io')

const websocket = (httpServer) => {
    const io =  new Server(httpServer, {
        cors: { credentials: true },
        connectionStateRecovery: {}
    })

    return io
}

module.exports = websocket