const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const net = require('net');
const dgram = require('dgram');

const TCP_PORT = process.env.TCP_PORT || 3001;
const UDP_PORT = process.env.UDP_PORT || 4000;

const upload = multer({ storage: multer.memoryStorage() });

router.get('/dashboard', (req, res) => {
    res.render('dashboard', { email: req.query.email || 'Pengguna', uploadStatus: req.query.success === 'true' });
});

router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file.');
    const client = new net.Socket();
    client.connect(TCP_PORT, '127.0.0.1', () => {
        client.write(req.file.buffer);
        client.end();
    });
    client.on('close', () => res.redirect(`/dashboard?email=${req.body.email}&success=true`));
});

router.get('/stream-video', (req, res) => {
    const files = fs.readdirSync('./uploads').filter(f => f.startsWith('TCP_Received_')).sort().reverse();
    if (files.length === 0) return res.status(404).send('Tidak ada video.');

    const videoPath = path.join(__dirname, '..', 'uploads', files[0]);
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

router.get('/start-udp', (req, res) => {
    const files = fs.readdirSync('./uploads').filter(f => f.startsWith('TCP_Received_')).sort().reverse();
    if (files.length > 0) {
        const videoPath = path.join(__dirname, '..', 'uploads', files[0]);
        const stream = fs.createReadStream(videoPath, { highWaterMark: 1024 }); 
        const udpClient = dgram.createSocket('udp4');

        stream.on('data', (chunk) => {
            udpClient.send(chunk, UDP_PORT, 'localhost');
        });
        stream.on('end', () => res.send({ status: 'started' }));
    } else {
        res.send({ status: 'no_file' });
    }
});

router.get('/udp-logs', (req, res) => {
    // Get log from app locals
    res.send({ log: req.app.locals.latestUdpLog || "" });
    req.app.locals.latestUdpLog = ""; 
});

module.exports = router;
