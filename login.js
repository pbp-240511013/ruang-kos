import { supabase } from './supabase.js';

const loginForm = document.getElementById('loginForm');
const pesan = document.getElementById('pesan');
const loginButton = document.getElementById('loginButton');

loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    pesan.textContent = 'Sedang memproses login...';
    pesan.style.color = '#765c48';
    loginButton.disabled = true;

    try {
        // 1. Memeriksa email dan password.
        const { data: loginData, error: loginError } =
            await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (loginError) throw loginError;

        // 2. Mengambil data profil pengguna.
        const { data: profile, error: profileError } =
            await supabase
                .from('profiles')
                .select('nama, role, akses_diblokir')
                .eq('id', loginData.user.id)
                .single();

        if (profileError || !profile) {
            await supabase.auth.signOut();
            throw new Error('Data profil akun tidak ditemukan.');
        }

        // 3. Memeriksa apakah akun penghuni diblokir.
        if (
            profile.role === 'penghuni' &&
            profile.akses_diblokir === true
        ) {
            await supabase.auth.signOut();

            throw new Error(
                'Akses akun Anda diblokir karena status penghuni sudah keluar. Silakan hubungi admin kos jika ingin menyewa kembali.'
            );
        }

        pesan.style.color = 'green';
        pesan.textContent =
            'Login berhasil! Selamat datang, ' + profile.nama;

        // 4. Mengarahkan pengguna berdasarkan role.
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