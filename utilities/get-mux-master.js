require('dotenv').config()
const readline = require("readline")
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const Mux = require('@mux/mux-node')
const { Video } = new Mux()

rl.question("Mux Asset ID? > ", async id => {
    rl.close()
    const asset = await Video.Assets.get(id)
    console.log(`Master is ${asset.master.status}. URL is ${asset.master.url}`)
})
