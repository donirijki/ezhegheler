const net = require('net');
const readline = require('readline');

// Membuat koneksi ke server
const client = net.createConnection({ port: 3000 }, () => {
    console.log('Berhasil terhubung ke server!');
});

// Menangani pesan yang diterima dari server
client.on('data', (data) => {
    console.log(data.toString());
});

// Mengirim pesan dari terminal ke server
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    client.write(input);
});

client.on('end', () => {
    console.log('Terputus dari server.');
    process.exit();
});
