require('dotenv').config()
const express = require('express')
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const Airtable = require('airtable-plus')
const nunjucks = require('nunjucks')

const airtableCreds = { baseID: process.env.AIRTABLE_BASE_ID, apiKey: process.env.AIRTABLE_API_KEY }
const db = {
    now: new Airtable({ ...airtableCreds, tableName: 'now' }),
    state: new Airtable({ ...airtableCreds, tableName: 'state' }),
    announcements: new Airtable({ ...airtableCreds, tableName: 'annoucements' })
}

app.use(express.static('public'))
nunjucks.configure('views', { autoescape: true, express: app, tags: { variableStart: '{$', variableEnd: '$}' } })

app.get('/', (req, res) => {
    res.render('index.html')
})

app.get('/admin', (req, res) => {
    res.render('admin.html')
})

app.get('/now', async (req, res) => {
    console.log('GET /now')
    const records = await db.now.read({})
    res.json(records.map(f => f.fields))
})

app.get('/state', async (req, res) => {
    console.log('GET /state')
    const records = await db.state.read({})
    const payload = {}
    for(let record of records) {
        payload[record.fields.key] = record.fields.value
    }
    res.json(payload)
})

io.on('connection', (socket) => {
    socket.on('now', async data => {
        console.log('Event of type now')
        io.emit('now', data)
        for(let key of ['primary', 'secondary', 'button_url', 'button_text']) {
            await db.state.updateWhere(`key = "${key}"`, { value: data[key] })
        }
    })

    socket.on('phase', async data => {
        console.log('Event of type phase')
        io.emit('phase', data)
        await db.state.updateWhere(`key = "phase"`, { value: data.phase })
    })

    socket.on('refresh', data => {
        console.log('Event of type refresh')
        io.emit('refresh')
    })
});

http.listen(3000, console.log('Listening on port 3000'))
