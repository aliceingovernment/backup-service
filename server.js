const Hapi = require('@hapi/hapi')
const Boom = require('@hapi/boom')
const AuthBearer = require('hapi-auth-bearer-token')
const levelup = require('levelup')
const leveldown = require('leveldown')
const encode = require('encoding-down')

const config = require('./config')

const db = levelup(encode(leveldown('./db'), { valueEncoding: 'json' }))

const internals = {}

internals.start = async function () {
  const server = Hapi.server({
    port: config.port
  })

  await server.register(AuthBearer)

  server.auth.strategy('simple', 'bearer-access-token', {
    validate: async (request, token, h) => {
      const isValid = token === config.token
      const credentials = {}
      return { isValid, credentials }
    }
  })

  server.route({
    method: 'POST',
    path: '/',
    options: {
      auth: {
        strategy: 'simple'
      },
      handler: save
    }
  })

  server.route({
    method: 'GET',
    path: '/',
    options: {
      auth: {
        strategy: 'simple'
      },
      handler: list
    }
  })

  await server.start()
}

internals.start()

async function save (request, h) {
  const vote = request.payload
  // check if vote exists
  try {
    await db.get(vote.email)
    return Boom.conflict()
  } catch (err) {
    try {
      await db.put(vote.email, vote)
    } catch (err) {
      console.log(err)
    }
  }
  return h.response().code(201)
}

async function list (request, h) {
  const list = []
  for await (const vote of db.createValueStream()) {
    list.push(vote)
  }
  return list
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

