require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const multer = require('multer');
const net = require('net');
const dgram = require('dgram');
const fs = require('fs');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;
const TCP_PORT = process.env.TCP_PORT || 3001;
const UDP_PORT = process.env.UDP_PORT || 4000;

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


// ==========================================
// KONFIGURASI GMAIL SMTP (SUNGGUHAN)
// ==========================================
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
    }
});

const pendingVerifications = {};

app.get('/', (req, res) => res.render('login', { error: null, success: req.query.success }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const dbPath = './users.json';
    let users = [];
    if (fs.existsSync(dbPath)) users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    let user = users.find(u => u.email === email);

    if (!user) {
        return res.render('login', { error: 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.', success: null });
    }
    if (user.password !== password) {
        return res.render('login', { error: 'Kata sandi yang Anda masukkan salah!', success: null });
    }

    // Password benar → kirim OTP 2FA ke email
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pendingVerifications[email] = { code, expiresAt: Date.now() + 10 * 60000, isNewUser: false };

    try {
        await transporter.sendMail({
            from: `"EzheGheler" <${GMAIL_USER}>`,
            to: email,
            subject: 'Kode Verifikasi 2FA EzheGheler',
            html: `<h2>Kode Verifikasi Keamanan</h2><p>Gunakan kode berikut untuk menyelesaikan proses masuk:</p><p><strong style="font-size:30px; color:#4f46e5; letter-spacing: 8px;">${code}</strong></p><p>Kode kedaluwarsa dalam <b>10 menit</b>.</p>`
        });
        console.log(`[AUTH] OTP 2FA dikirim ke: ${email}`);
        res.redirect(`/verify?email=${encodeURIComponent(email)}`);
    } catch (e) {
        console.error('[SMTP ERROR]', e.message);
        res.render('login', { error: 'Gagal mengirim email verifikasi. Cek konfigurasi SMTP.', success: null });
    }
});

// Rute Registrasi Akun Baru
app.get('/register', (req, res) => res.render('register', { error: null, success: null }));

app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    const dbPath = './users.json';
    let users = [];
    if (fs.existsSync(dbPath)) users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    if (users.find(u => u.email === email)) {
        return res.render('register', { error: 'Email ini sudah terdaftar! Silakan login.', success: null });
    }

    // Kirim OTP untuk verifikasi pendaftaran
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pendingVerifications[email] = { password, code, expiresAt: Date.now() + 10 * 60000, isNewUser: true };

    try {
        await transporter.sendMail({
            from: `"EzheGheler" <${GMAIL_USER}>`,
            to: email,
            subject: 'Verifikasi Pendaftaran Akun EzheGheler',
            html: `<h2>Selamat Datang di EzheGheler!</h2><p>Gunakan kode berikut untuk menyelesaikan pendaftaran akun Anda:</p><p><strong style="font-size:30px; color:#4f46e5; letter-spacing: 8px;">${code}</strong></p><p>Kode kedaluwarsa dalam <b>10 menit</b>.</p>`
        });
        console.log(`[AUTH] OTP Registrasi dikirim ke: ${email}`);
        res.redirect(`/verify?email=${encodeURIComponent(email)}`);
    } catch (e) {
        console.error('[SMTP ERROR]', e.message);
        res.render('register', { error: 'Gagal mengirim email verifikasi. Cek konfigurasi SMTP.', success: null });
    }
});

// Verifikasi Kode OTP
app.get('/verify', (req, res) => res.render('verify', { email: req.query.email, error: null }));

app.post('/verify', (req, res) => {
    const { email, code } = req.body;
    const pending = pendingVerifications[email];

    if (!pending || Date.now() > pending.expiresAt) {
        return res.render('verify', { email, error: 'Sesi kedaluwarsa atau tidak valid. Silakan ulangi login.' });
    }

    if (pending.code === code) {
        // Jika OTP benar
        if (pending.isNewUser) {
            const dbPath = './users.json';
            let users = [];
            if (fs.existsSync(dbPath)) users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            users.push({ email, password: pending.password });
            fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
            console.log(`[AUTH] Pengguna baru terdaftar dan diverifikasi: ${email}`);
        } else {
            console.log(`[AUTH] Pengguna lama berhasil verifikasi 2FA: ${email}`);
        }

        delete pendingVerifications[email];
        res.redirect(`/dashboard?email=${encodeURIComponent(email)}`);
    } else {
        res.render('verify', { email, error: 'Kode verifikasi salah!' });
    }
});

// Simulasi Google OAuth 2.0 (Pop-up Buatan)
app.get('/auth/google', (req, res) => {
    const email = "donnyrizkyramadhan@gmail.com";

    // Simpan ke users.json jika belum ada
    const dbPath = './users.json';
    let users = [];
    if (fs.existsSync(dbPath)) users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    if (!users.find(u => u.email === email)) {
        users.push({ email, password: "Google_OAuth_User" });
        fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
        console.log(`[AUTH] User Google OAuth baru terdaftar: ${email}`);
    } else {
        console.log(`[AUTH] Login Google OAuth disimulasikan: ${email}`);
    }

    res.redirect(`/dashboard?email=${encodeURIComponent(email)}`);
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