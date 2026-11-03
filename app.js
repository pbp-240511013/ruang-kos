
const loginButton = document.getElementById("loginButton");

loginButton.addEventListener("click", function () {
    alert("Fitur login RuangKos akan segera tersedia!");
});


import { supabase } from './supabase.js';

console.log('Supabase siap digunakan!');
console.log('Client:', supabase);

// Tes membaca data dari Supabase
const { data, error } = await supabase
    .from('kamar')
    .select('*');

if (error) {
    console.error('Gagal mengambil data kamar:', error.message);
} else {
    console.log('Berhasil membaca tabel kamar:', data);
}