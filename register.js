
import { supabase } from './supabase.js';

const registerForm = document.getElementById('registerForm');
const pesan = document.getElementById('pesan');
const registerButton = document.getElementById('registerButton');

registerForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const nama = document.getElementById('nama').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const konfirmasiPassword =
        document.getElementById('konfirmasiPassword').value;

    if (nama.length < 2) {
        pesan.style.color = 'red';
        pesan.textContent = 'Nama minimal 2 karakter.';
        return;
    }

    if (password.length < 6) {
        pesan.style.color = 'red';
        pesan.textContent = 'Password minimal 6 karakter.';
        return;
    }

    if (password !== konfirmasiPassword) {
        pesan.style.color = 'red';
        pesan.textContent = 'Konfirmasi password tidak cocok.';
        return;
    }

    registerButton.disabled = true;
    pesan.style.color = '#765c48';
    pesan.textContent = 'Sedang membuat akun...';

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    nama: nama
                }
            }
        });

        if (error) throw error;

        if (data.session) {
            pesan.style.color = 'green';
            pesan.textContent =
                'Pendaftaran berhasil! Silakan login.';

            registerForm.reset();

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } else {
            pesan.style.color = 'green';
            pesan.textContent =
                'Pendaftaran berhasil! Silakan periksa email untuk verifikasi sebelum login.';
        }

    } catch (error) {
        pesan.style.color = 'red';
        pesan.textContent = error.message;

    } finally {
        registerButton.disabled = false;
    }
});
