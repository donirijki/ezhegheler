const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error('⚠️  [PERINGATAN] GMAIL_USER atau GMAIL_APP_PASSWORD tidak ditemukan di .env!');
}

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

const pendingVerifications = {};

// Endpoint untuk mengecek latency real-time
router.get('/ping', (req, res) => res.json({ status: 'ok' }));

router.get('/', (req, res) => res.render('login', { error: null, success: req.query.success }));

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const dbPath = './users.json';
    let users = [];
    if (fs.existsSync(dbPath)) users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    let user = users.find(u => u.email === email);

    if (!user) {
        return res.render('login', { error: 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.', success: null });
    }
    const isMatch = user.password.startsWith('$2') 
        ? bcrypt.compareSync(password, user.password) 
        : user.password === password;

    if (!isMatch) {
        return res.render('login', { error: 'Kata sandi yang Anda masukkan salah!', success: null });
    }

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

router.get('/register', (req, res) => res.render('register', { error: null, success: null }));

router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    const dbPath = './users.json';
    let users = [];
    if (fs.existsSync(dbPath)) users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    if (users.find(u => u.email === email)) {
        return res.render('register', { error: 'Email ini sudah terdaftar! Silakan login.', success: null });
    }

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

router.get('/verify', (req, res) => res.render('verify', { email: req.query.email, error: null }));

router.post('/verify', (req, res) => {
    const { email, code } = req.body;
    const pending = pendingVerifications[email];

    if (!pending || Date.now() > pending.expiresAt) {
        return res.render('verify', { email, error: 'Sesi kedaluwarsa atau tidak valid. Silakan ulangi login.' });
    }

    if (pending.code === code) {
        if (pending.isNewUser) {
            const dbPath = './users.json';
            let users = [];
            if (fs.existsSync(dbPath)) users = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const hashedPassword = bcrypt.hashSync(pending.password, 10);
            users.push({ email, password: hashedPassword });
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

router.get('/auth/google', (req, res) => {
    const email = "donnyrizkyramadhan@gmail.com";
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

module.exports = router;
