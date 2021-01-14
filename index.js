require('dotenv').config()
const express = require('express')
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const Airtable = require('airtable-plus')
const nunjucks = require('nunjucks')
const showdown = require('showdown')

const airtableCreds = { baseID: process.env.AIRTABLE_BASE_ID, apiKey: process.env.AIRTABLE_API_KEY }
const db = {
    now: new Airtable({ ...airtableCreds, tableName: 'now' }),
    state: new Airtable({ ...airtableCreds, tableName: 'state' }),
    announcements: new Airtable({ ...airtableCreds, tableName: 'announcements' }),
    sponsors: new Airtable({ ...airtableCreds, tableName: 'sponsors' }),
    about: new Airtable({ ...airtableCreds, tableName: 'about' }),
}

app.use(express.static('public'))
nunjucks.configure('views', { autoescape: true, express: app, tags: { variableStart: '{$', variableEnd: '$}' } })
const converter = new showdown.Converter()

app.get('/', (req, res) => {
    res.render('index.html')
})

app.get('/operator', (req, res) => {
    res.render('admin.html')
})

app.get('/sponsors', (req, res) => {
    res.redirect('/')
})

app.get('/sponsors/:sponsor', (req, res) => {
    res.render('sponsor.html', { sponsor: req.params.sponsor })
})

app.get('/test', (req, res) => {
    res.render('test.html')
})

app.get('/now', async (req, res) => {
    console.log('GET /now')
    const records = await db.now.read({})
    res.json(records.map(f => f.fields))
})

app.get('/state', async (req, res) => {
    console.log('GET /state')
    const records = await db.state.read({})
    const state = {}
    for(let record of records) {
        state[record.fields.key] = record.fields.value
    }
    const announcements = await db.announcements.read({ sort: [{field: 'created', direction: 'desc'}] })
    const sponsors = await db.sponsors.read({ sort: [{field: 'name', direction: 'asc'}] })
    const about = await db.about.read({})
    res.json({
        ...state,
        announcements: announcements.map(a => a.fields),
        sponsors: sponsors.map(s => s.fields),
        about: converter.makeHtml(about[0].fields.content)
    })
})

io.on('connection', (socket) => {
    const key = process.env.ADMIN_KEY

    socket.on('now', async data => {
        console.log('Event of type now')
        if(data.key == key) {
            delete data.key
            io.emit('now', data)
            for(let key of ['primary', 'secondary', 'button_url', 'button_text']) {
                await db.state.updateWhere(`key = "${key}"`, { value: data[key] })
            }
        }
    })

    socket.on('phase', async data => {
        io.emit('phase', data)
        if(data.key == key) {
            delete data.key
            await db.state.updateWhere(`key = "phase"`, { value: data.phase })
        }
    })

    socket.on('announcement:create', async data => {
        console.log('Event of type announcement:create')
        if(data.key == key) {
            delete data.key
            io.emit('announcement:create', data)
            await db.announcements.create(data)
        }
    })

    socket.on('announcement:delete', async data => {
        console.log('Event of type announcement:delete')
        if(data.key == key) {
            delete data.key
            io.emit('announcement:delete', data.uaid)
            await db.announcements.deleteWhere(`uaid = "${data.uaid}"`)
        }
    })

    socket.on('refresh', data => {
        console.log('Event of type refresh')
        if(data.key == key) {
            delete data.key
            io.emit('refresh')
        }
    })

    socket.on('fallback', data => {
        console.log('Event of type fallback')
        if(data.key == key) {
            delete data.key
            io.emit('fallback')
        }
    })
});

http.listen(process.env.PORT || 3000, console.log('Listening on port 3000'))
