function togglePassword() {
    const pwd = document.getElementById('password');
    const icon = document.getElementById('eyeIcon');
    if (pwd.type === 'password') {
        pwd.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        pwd.type = 'password';
        icon.className = 'fa-solid fa-eye';
    }
}
