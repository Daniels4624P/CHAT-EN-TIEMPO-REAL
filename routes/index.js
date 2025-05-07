const express = require('express')
const routerAuth = require('./authRouter')

const routerApi = (app) => {
    const router = express.Router()
    app.use('/api/v1', router)
    router.use('/auth', routerAuth)
}

module.exports = routerApi