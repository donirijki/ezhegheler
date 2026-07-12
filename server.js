const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const multer = require('multer');
const net = require('net');
const dgram = require('dgram');
const fs = require('fs');

const app = express();
const PORT = 3000;
const TCP_PORT = 3001;
const UDP_PORT = 4000;

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// FASE 3: SERVER TCP MURNI UNTUK UPLOAD FILE
// ==========================================
const tcpServer = net.createServer((socket) => {
    const fileName = `TCP_Received_${Date.now()}.bin`;
    const writeStream = fs.createWriteStream(path.join(__dirname, 'uploads', fileName));
    socket.pipe(writeStream);
});
tcpServer.listen(TCP_PORT, () => console.log(`🔌 Server TCP (Upload) berjalan di port ${TCP_PORT}`));

// ==========================================
// FASE 4: SERVER UDP UNTUK VIDEO STREAMING
// ==========================================
const udpServer = dgram.createSocket('udp4');
let latestUdpLog = "";

udpServer.on('message', (msg, rinfo) => {
    latestUdpLog = `[UDP SERVER] Menerima ${msg.length} bytes dari ${rinfo.address}:${rinfo.port}`;
    console.log(latestUdpLog);
});
udpServer.bind(UDP_PORT, () => console.log(`📡 Server UDP (Streaming) mendengarkan di port ${UDP_PORT}`));

// ==========================================
// KONFIGURASI EXPRESS & WEB SERVER
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let transporter;
nodemailer.createTestAccount().then((account) => {
    transporter = nodemailer.createTransport({
        host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass }
    });
});

app.get('/', (req, res) => res.render('login', { error: null }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Sistem Database Mini (users.json)
    const dbPath = './users.json';
    let users = [];
    if (fs.existsSync(dbPath)) {
        users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }

    let user = users.find(u => u.email === email);
    let isLoginValid = false;
    let errorMsg = "";

    if (!user) {
        // Jika email belum ada, otomatis daftar (auto-register) untuk kemudahan
        users.push({ email, password });
        fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
        isLoginValid = true;
        console.log(`[AUTH] Pengguna baru terdaftar: ${email}`);
    } else {
        // Jika email sudah ada, WAJIB cocokkan password-nya
        if (user.password === password) {
            isLoginValid = true;
            console.log(`[AUTH] Login berhasil: ${email}`);
        } else {
            errorMsg = "Kata sandi yang Anda masukkan salah!";
            console.log(`[AUTH] Login gagal (password salah): ${email}`);
        }
    }

    if (isLoginValid) {
        try {
            const info = await transporter.sendMail({
                from: '"Sistem" <no-reply@jaringan.com>', to: email, subject: 'Login Berhasil',
                html: `<h2>Sukses</h2><p>Waktu: ${new Date().toLocaleString('id-ID')}</p>`
            });
            console.log(`🔗 EMAIL DI SINI: ${nodemailer.getTestMessageUrl(info)}`);
            res.redirect(`/dashboard?email=${email}`);
        } catch (e) { res.render('login', { error: 'Gagal mengirim email.' }); }
    } else { res.render('login', { error: errorMsg }); }
});

app.get('/dashboard', (req, res) => {
    res.render('dashboard', { email: req.query.email || 'Pengguna', uploadStatus: req.query.success === 'true' });
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file.');
    const client = new net.Socket();
    client.connect(TCP_PORT, '127.0.0.1', () => {
        client.write(req.file.buffer);
        client.end();
    });
    client.on('close', () => res.redirect(`/dashboard?email=${req.body.email}&success=true`));
});

// Endpoint untuk memutar video (HTTP Range Stream)
app.get('/stream-video', (req, res) => {
    // Cari file terbaru di folder uploads
    const files = fs.readdirSync('./uploads').filter(f => f.startsWith('TCP_Received_')).sort().reverse();
    if (files.length === 0) return res.status(404).send('Tidak ada video.');
    
    const videoPath = path.join(__dirname, 'uploads', files[0]);
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

// Endpoint untuk memulai transmisi UDP murni
app.get('/start-udp', (req, res) => {
    const files = fs.readdirSync('./uploads').filter(f => f.startsWith('TCP_Received_')).sort().reverse();
    if (files.length > 0) {
        const videoPath = path.join(__dirname, 'uploads', files[0]);
        const stream = fs.createReadStream(videoPath, { highWaterMark: 1024 }); // baca per 1KB
        const udpClient = dgram.createSocket('udp4');
        
        stream.on('data', (chunk) => {
            udpClient.send(chunk, UDP_PORT, 'localhost');
        });
        stream.on('end', () => res.send({ status: 'started' }));
    } else {
        res.send({ status: 'no_file' });
    }
});

// Endpoint untuk frontend mengambil log UDP terakhir
app.get('/udp-logs', (req, res) => {
    res.send({ log: latestUdpLog });
    latestUdpLog = ""; // Bersihkan setelah dibaca
});

app.listen(PORT, () => console.log(`🌐 Web Server (Express) berjalan di http://localhost:${PORT}`));