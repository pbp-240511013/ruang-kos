```javascript
import { supabase } from './supabase.js';

// Tombol menuju halaman login
const loginButton = document.getElementById("loginButton");

if (loginButton) {
    loginButton.addEventListener("click", function () {
        window.location.href = "login.html";
    });
}

// Memeriksa koneksi Supabase
console.log('Supabase siap digunakan!');

// Mengambil data kamar
const { data, error } = await supabase
    .from('kamar')
    .select('*');

if (error) {
    console.error('Gagal mengambil data kamar:', error.message);
} else {
    console.log('Berhasil membaca tabel kamar:', data);
}
```