require('dotenv').config();
const express = require('express');
const path = require('path');
const net = require('net');
const dgram = require('dgram');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const TCP_PORT = process.env.TCP_PORT || 3001;
const UDP_PORT = process.env.UDP_PORT || 4000;

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// ==========================================
// SERVER TCP MURNI UNTUK UPLOAD FILE
// ==========================================
const tcpServer = net.createServer((socket) => {
    const fileName = `TCP_Received_${Date.now()}.bin`;
    const writeStream = fs.createWriteStream(path.join(__dirname, 'uploads', fileName));
    socket.pipe(writeStream);
});
tcpServer.listen(TCP_PORT, () => console.log(`🔌 Server TCP (Upload) berjalan di port ${TCP_PORT}`));

// ==========================================
// SERVER UDP UNTUK VIDEO STREAMING
// ==========================================
app.locals.latestUdpLog = "";
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
    app.locals.latestUdpLog = `[UDP SERVER] Menerima ${msg.length} bytes dari ${rinfo.address}:${rinfo.port}`;
    console.log(app.locals.latestUdpLog);
});
udpServer.bind(UDP_PORT, () => console.log(`📡 Server UDP (Streaming) mendengarkan di port ${UDP_PORT}`));

// ==========================================
// KONFIGURASI EXPRESS & WEB SERVER
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// MENGGUNAKAN ROUTER MODULAR
// ==========================================
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

// Semua urusan login/register diatur oleh authRoutes
app.use('/', authRoutes);

// Semua urusan halaman dashboard diatur oleh dashboardRoutes
app.use('/', dashboardRoutes);

app.listen(PORT, () => console.log(`🌐 Web Server (Express) berjalan di http://localhost:${PORT}`));