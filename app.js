
import { supabase } from './supabase.js';

// =====================================
// RUANGKOS - MAIN APPLICATION
// =====================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. Tombol menuju halaman login
    const loginButton = document.getElementById('loginButton');

    if (loginButton) {
        loginButton.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = './login.html';
        });
    }

    // 2. Tombol menuju halaman daftar (jika tersedia)
    const registerButton = document.getElementById('registerButton');

    if (registerButton) {
        registerButton.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = './register.html';
        });
    }

    // 3. Tombol menuju beranda (jika tersedia)
    const homeButton = document.getElementById('homeButton');

    if (homeButton) {
        homeButton.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = './index.html';
        });
    }

    console.log('RuangKos berhasil dijalankan!');
});


// =====================================
// 4. CEK KONEKSI SUPABASE
// =====================================

async function cekKoneksiSupabase() {
    try {
        const { data, error } = await supabase
            .from('kamar')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Gagal terhubung ke Supabase:', error.message);
            return;
        }

        console.log('Koneksi Supabase berhasil!');
        console.log('Data kamar:', data);

    } catch (error) {
        console.error('Terjadi kesalahan:', error.message);
    }
}

cekKoneksiSupabase();
