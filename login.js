
import { supabase } from './supabase.js';

const loginForm = document.getElementById('loginForm');
const pesan = document.getElementById('pesan');
const loginButton = document.getElementById('loginButton');

loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    pesan.textContent = 'Sedang memproses login...';
    pesan.style.color = '#765c48';
    loginButton.disabled = true;

    try {
        // Memeriksa email dan password
        const { data: loginData, error: loginError } =
            await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (loginError) {
            throw loginError;
        }

        // Mengambil peran akun dari tabel profiles
        const { data: profile, error: profileError } =
            await supabase
                .from('profiles')
                .select('nama, role')
                .eq('id', loginData.user.id)
                .single();

        if (profileError || !profile) {
            await supabase.auth.signOut();
            throw new Error('Data profil akun tidak ditemukan.');
        }

        pesan.style.color = 'green';
        pesan.textContent = 'Login berhasil! Selamat datang, ' + profile.nama;

        // Mengarahkan pengguna sesuai perannya
        if (profile.role === 'admin') {
            window.location.href = 'admin.html';
        } else if (profile.role === 'penghuni') {
            window.location.href = 'penghuni.html';
        } else {
            await supabase.auth.signOut();
            throw new Error('Peran akun tidak dikenali.');
        }

    } catch (error) {
        pesan.style.color = 'red';
        pesan.textContent = error.message;
    } finally {
        loginButton.disabled = false;
    }
});
