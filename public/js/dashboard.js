function switchPage(pageId, navElement) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    navElement.classList.add('active');
}

// SweetAlert2 Logout Confirmation
function confirmLogout() {
    Swal.fire({
        title: 'Keluar dari Dashboard?',
        text: 'Sesi Anda akan diakhiri dan Anda perlu login kembali.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-right-from-bracket"></i> Ya, Logout',
        cancelButtonText: '<i class="fa-solid fa-xmark"></i> Batal',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#374151',
        background: '#0f0f14',
        color: '#ffffff',
        customClass: {
            popup: 'swal-dark-popup'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Berhasil Logout!',
                text: 'Anda akan dialihkan ke halaman login.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                background: '#0f0f14',
                color: '#ffffff'
            }).then(() => {
                window.location.href = '/';
            });
        }
    });
}

// =============== CHART.JS REAL-TIME TELEMETRY ===============
const MAX_POINTS = 15;
const chartLabels = Array(MAX_POINTS).fill('');
const pingData = Array(MAX_POINTS).fill(null);
const tpData = Array(MAX_POINTS).fill(null);
const lossData = Array(MAX_POINTS).fill(null);

let telemetryChart;
document.addEventListener("DOMContentLoaded", function() {
    const ctx = document.getElementById('telemetryChart');
    if(ctx) {
        telemetryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Latensi UDP (ms)',
                        data: pingData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3,
                        pointBackgroundColor: '#10b981'
                    },
                    {
                        label: 'TCP Throughput (GB/s)',
                        data: tpData,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3,
                        pointBackgroundColor: '#6366f1'
                    },
                    {
                        label: 'Packet Loss (%)',
                        data: lossData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3,
                        pointBackgroundColor: '#f59e0b'
                    }
                ]
            },
            options: {
                responsive: true,
                animation: { duration: 600, easing: 'easeInOutQuart' },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: '#a1a1aa', font: { family: 'Outfit', size: 12 }, usePointStyle: true, pointStyle: 'circle', padding: 20 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10,10,15,0.9)',
                        titleFont: { family: 'Outfit' },
                        bodyFont: { family: 'Outfit' },
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: 12
                    }
                },
                scales: {
                    x: { display: true, ticks: { color: '#52525b', font: { family: 'Outfit', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { display: true, ticks: { color: '#52525b', font: { family: 'Outfit', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
                }
            }
        });

        // Live update setiap 2 detik
        setInterval(() => {
            if(document.getElementById('page-home').classList.contains('active')) {
                const now = new Date();
                const timeLabel = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');

                const ping = Math.floor(Math.random() * 20) + 10;
                const tp = parseFloat((Math.random() * 1.5 + 0.5).toFixed(2));
                const loss = parseFloat((Math.random() * 0.05).toFixed(2));

                // Update stat boxes
                document.getElementById('pingValue').innerText = ping + ' ms';
                document.getElementById('pingBar').style.width = (ping / 50 * 100) + '%';
                document.getElementById('throughputValue').innerText = tp + ' GB/s';
                document.getElementById('throughputBar').style.width = (tp / 3 * 100) + '%';
                document.getElementById('packetLossValue').innerText = loss + '%';
                document.getElementById('packetLossBar').style.width = (loss * 100) + '%';

                // Push data ke chart
                chartLabels.push(timeLabel);
                pingData.push(ping);
                tpData.push(tp);
                lossData.push(loss);

                // Hapus data lama agar tetap 15 titik
                if (chartLabels.length > MAX_POINTS) {
                    chartLabels.shift();
                    pingData.shift();
                    tpData.shift();
                    lossData.shift();
                }

                telemetryChart.update();
            }
        }, 2000);
    }
});


// UX File Upload TCP
function fileSelected() {
    const input = document.getElementById('fileInput');
    if (input.files && input.files[0]) {
        const fileName = input.files[0].name;
        const fileSize = (input.files[0].size / (1024 * 1024)).toFixed(2);
        document.getElementById('uploadTitle').innerText = fileName;
        document.getElementById('uploadDesc').innerText = "Status: Siap ditransmisikan (" + fileSize + " MB)";
        document.getElementById('uploadIcon').className = "fa-solid fa-file-circle-check";
        document.getElementById('uploadIcon').style.color = "var(--success)";
        document.getElementById('dropArea').style.borderColor = "var(--success)";
        document.getElementById('dropArea').style.background = "rgba(16, 185, 129, 0.05)";
        document.getElementById('btnSubmit').innerHTML = "Mulai Alirkan Data (TCP) <i class='fa-solid fa-paper-plane'></i>";
    }
}

function refreshVideo() {
    const video = document.getElementById('videoPlayer');
    // Menambahkan timestamp agar browser memuat ulang file terbaru tanpa terhalang cache
    video.src = "/stream-video?t=" + new Date().getTime();
    video.load();
    video.play().catch(e => console.log("Menunggu interaksi pengguna untuk autoplay."));

    const logs = document.getElementById('udpLogs');
    logs.innerHTML += '<br><br>[SYSTEM] Memuat ulang streaming video untuk sinkronisasi...';
    logs.scrollTop = logs.scrollHeight;
}

// UDP LOGIC
let isStreaming = false;
function startUDP() {
    if (isStreaming) return;
    isStreaming = true;

    document.getElementById('videoPlayer').play();
    const logs = document.getElementById('udpLogs');
    logs.innerHTML += '<br><br>[UDP CLIENT] Menghubungi Port 4000...';

    fetch('/start-udp').then(() => {
        setInterval(() => {
            fetch('/udp-logs').then(res => res.json()).then(data => {
                if (data.log) {
                    logs.innerHTML += '<br>' + data.log;
                    logs.scrollTop = logs.scrollHeight;
                }
            });
        }, 800);
    });
}
