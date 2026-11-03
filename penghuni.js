
import { supabase } from './supabase.js';

const pesan = document.getElementById('pesan');
const namaPenghuni = document.getElementById('namaPenghuni');
const informasiKamar = document.getElementById('informasiKamar');
const tabelTagihan = document.getElementById('tabelTagihan');
const tabelPembayaran = document.getElementById('tabelPembayaran');
const pesanPembayaran = document.getElementById('pesanPembayaran');

const BUCKET_BUKTI = 'bukti-pembayaran';
const BATAS_FILE = 5 * 1024 * 1024;

let userAktif = null;

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

function rupiah(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(value || 0);
}

function tanggal(value) {
    if (!value) return '-';

    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function labelStatus(status) {
    const labels = {
        belum_bayar: 'Belum dibayar',
        menunggu_verifikasi: 'Menunggu verifikasi',
        lunas: 'Lunas',
        ditolak: 'Ditolak'
    };

    return labels[status] || status;
}

function ekstensiFile(file) {
    const tipe = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    };

    return tipe[file.type] || null;
}

// Membuat link sementara untuk melihat bukti dari bucket privat
async function buatLinkBukti(path) {
    if (!path) return null;

    const { data, error } = await supabase.storage
        .from(BUCKET_BUKTI)
        .createSignedUrl(path, 300);

    if (error) {
        console.error('Gagal membuat link bukti:', error.message);
        return null;
    }

    return data.signedUrl;
}

// Mengambil dan menampilkan tagihan
async function muatTagihan(penghuniId) {
    const { data: pembayaran, error } = await supabase
        .from('pembayaran')
        .select('id, jumlah, bulan_tagihan, tanggal_bayar, status, metode_pembayaran, bukti_pembayaran, catatan_verifikasi')
        .eq('penghuni_id', penghuniId)
        .order('bulan_tagihan', { ascending: false });

    if (error) throw error;

    if (!pembayaran || pembayaran.length === 0) {
        tabelTagihan.innerHTML =
            '<tr><td colspan="5">Belum ada tagihan.</td></tr>';

        tabelPembayaran.innerHTML =
            '<tr><td colspan="4">Belum ada riwayat pembayaran.</td></tr>';

        return;
    }

    const barisTagihan = await Promise.all(pembayaran.map(async item => {
        const status = String(item.status || '').toLowerCase();
        const linkBukti = item.bukti_pembayaran
            ? await buatLinkBukti(item.bukti_pembayaran)
            : null;

        let informasiBukti = '-';

        if (item.bukti_pembayaran && linkBukti) {
            informasiBukti = `
                <a class="proof-link"
                   href="${escapeHTML(linkBukti)}"
                   target="_blank"
                   rel="noopener noreferrer">
                    Lihat bukti pembayaran
                </a>
                <br><small>Metode: ${escapeHTML(item.metode_pembayaran || '-')}</small>
            `;
        } else if (item.bukti_pembayaran) {
            informasiBukti = 'Bukti sudah dikirim';
        }

        if (status === 'ditolak' && item.catatan_verifikasi) {
            informasiBukti += `
                <div class="reason">
                    Alasan penolakan: ${escapeHTML(item.catatan_verifikasi)}
                </div>
            `;
        }

        let formulir = '-';

        if (status === 'belum_bayar' || status === 'ditolak') {
            formulir = `
                <form class="payment-form" data-payment-id="${escapeHTML(item.id)}">
                    <select name="metode" required>
                        <option value="">Pilih metode</option>
                        <option value="transfer">Transfer bank</option>
                        <option value="tunai">Tunai</option>
                    </select>

                    <input
                        type="file"
                        name="bukti"
                        accept="image/jpeg,image/png,image/webp"
                        required
                    >

                    <small>Format JPG, PNG, atau WEBP. Maksimal 5 MB.</small>

                    <button type="submit" class="upload-button">
                        ${status === 'ditolak' ? 'Kirim Ulang Bukti' : 'Kirim Bukti'}
                    </button>
                </form>
            `;
        } else if (status === 'menunggu_verifikasi') {
            formulir = '<span class="status">Menunggu pemeriksaan admin</span>';
        } else if (status === 'lunas') {
            formulir = '<span class="status">Pembayaran diterima</span>';
        }

        return `
            <tr>
                <td>${escapeHTML(item.bulan_tagihan)}</td>
                <td>${rupiah(item.jumlah)}</td>
                <td><span class="status">${escapeHTML(labelStatus(status))}</span></td>
                <td>${informasiBukti}</td>
                <td>${formulir}</td>
            </tr>
        `;
    }));

    tabelTagihan.innerHTML = barisTagihan.join('');

    // Riwayat pembayaran yang sudah disetujui admin
    const riwayat = pembayaran.filter(item =>
        String(item.status).toLowerCase() === 'lunas'
    );

    if (riwayat.length === 0) {
        tabelPembayaran.innerHTML =
            '<tr><td colspan="4">Belum ada pembayaran lunas.</td></tr>';
    } else {
        tabelPembayaran.innerHTML = riwayat.map(item => `
            <tr>
                <td>${escapeHTML(item.bulan_tagihan)}</td>
                <td>${tanggal(item.tanggal_bayar)}</td>
                <td>${rupiah(item.jumlah)}</td>
                <td><span class="status">Lunas</span></td>
            </tr>
        `).join('');
    }
}

// Mengirim bukti pembayaran
tabelTagihan.addEventListener('submit', async function(event) {
    const form = event.target.closest('.payment-form');
    if (!form) return;

    event.preventDefault();

    const tombol = form.querySelector('button[type="submit"]');
    const paymentId = form.dataset.paymentId;
    const metode = form.querySelector('[name="metode"]').value;
    const file = form.querySelector('[name="bukti"]').files[0];

    if (!metode) {
        pesanPembayaran.textContent = 'Pilih metode pembayaran terlebih dahulu.';
        return;
    }

    if (!file) {
        pesanPembayaran.textContent = 'Pilih foto bukti pembayaran terlebih dahulu.';
        return;
    }

    const ekstensi = ekstensiFile(file);

    if (!ekstensi) {
        pesanPembayaran.textContent = 'File harus berupa JPG, PNG, atau WEBP.';
        return;
    }

    if (file.size > BATAS_FILE) {
        pesanPembayaran.textContent = 'Ukuran file maksimal 5 MB.';
        return;
    }

    tombol.disabled = true;
    tombol.textContent = 'Mengunggah...';
    pesanPembayaran.style.color = '#765c48';
    pesanPembayaran.textContent = 'Sedang mengunggah bukti pembayaran...';

    let pathBukti = null;

    try {
        const namaFile = `${Date.now()}-${crypto.randomUUID()}.${ekstensi}`;
        pathBukti = `${userAktif.id}/${paymentId}/${namaFile}`;

        // Upload ke bucket privat
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_BUKTI)
            .upload(pathBukti, file, {
                cacheControl: '3600',
                contentType: file.type,
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Memanggil fungsi database untuk memeriksa kepemilikan tagihan
        const { error: rpcError } = await supabase.rpc(
            'kirim_bukti_pembayaran',
            {
                p_pembayaran_id: String(paymentId),
                p_metode: metode,
                p_bukti_path: pathBukti
            }
        );

        if (rpcError) throw rpcError;

        pesanPembayaran.style.color = 'green';
        pesanPembayaran.textContent =
            'Bukti berhasil dikirim. Silakan tunggu verifikasi admin.';

        await muatTagihan(window.idPenghuniAktif);

    } catch (error) {
        console.error('Gagal mengirim bukti:', error);

        // Jika proses database gagal, hapus file yang baru saja diunggah
        if (pathBukti) {
            await supabase.storage
                .from(BUCKET_BUKTI)
                .remove([pathBukti]);
        }

        pesanPembayaran.style.color = 'red';
        pesanPembayaran.textContent =
            'Gagal mengirim bukti: ' + error.message;

        tombol.disabled = false;
        tombol.textContent = 'Kirim Bukti';
    }
});

// Memuat dashboard penghuni
async function muatDashboard() {
    try {
        const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        userAktif = sessionData.session?.user;

        if (!userAktif) {
            window.location.href = 'login.html';
            return;
        }

        const { data: profil, error: profilError } = await supabase
            .from('profiles')
            .select('nama, role')
            .eq('id', userAktif.id)
            .single();

        if (profilError) throw profilError;

        if (profil.role !== 'penghuni') {
            window.location.href = 'login.html';
            return;
        }

        namaPenghuni.textContent = profil.nama || 'Penghuni';

        const { data: penghuni, error: penghuniError } = await supabase
            .from('penghuni')
            .select('id, kamar_id, nama, no_hp, alamat, tanggal_masuk')
            .eq('user_id', userAktif.id)
            .maybeSingle();

        if (penghuniError) throw penghuniError;

        if (!penghuni) {
            pesan.textContent =
                'Akun berhasil dibuat, tetapi kamu belum mendapatkan penempatan kamar.';

            informasiKamar.innerHTML = `
                <div class="empty-message">
                    <strong>Belum ada kamar yang ditetapkan.</strong><br>
                    Admin akan mengatur kamar untuk akun kamu.
                </div>
            `;

            tabelTagihan.innerHTML =
                '<tr><td colspan="5">Belum ada tagihan.</td></tr>';

            tabelPembayaran.innerHTML =
                '<tr><td colspan="4">Belum ada riwayat pembayaran.</td></tr>';

            return;
        }

        pesan.textContent = 'Data akun berhasil dimuat.';

        if (penghuni.kamar_id) {
            const { data: kamar, error: kamarError } = await supabase
                .from('kamar')
                .select('nomor_kamar, tipe_kamar, harga_bulanan, status')
                .eq('id', penghuni.kamar_id)
                .maybeSingle();

            if (kamarError) throw kamarError;

            if (kamar) {
                informasiKamar.innerHTML = `
                    <div class="info-grid">
                        <div class="info-item">
                            <small>Nomor Kamar</small>
                            <strong>${escapeHTML(kamar.nomor_kamar)}</strong>
                        </div>
                        <div class="info-item">
                            <small>Tipe Kamar</small>
                            <strong>${escapeHTML(kamar.tipe_kamar)}</strong>
                        </div>
                        <div class="info-item">
                            <small>Harga per Bulan</small>
                            <strong>${rupiah(kamar.harga_bulanan)}</strong>
                        </div>
                        <div class="info-item">
                            <small>Status Kamar</small>
                            <strong>${escapeHTML(kamar.status)}</strong>
                        </div>
                        <div class="info-item">
                            <small>Tanggal Masuk</small>
                            <strong>${tanggal(penghuni.tanggal_masuk)}</strong>
                        </div>
                        <div class="info-item">
                            <small>Nomor HP</small>
                            <strong>${escapeHTML(penghuni.no_hp || '-')}</strong>
                        </div>
                    </div>
                `;
            } else {
                informasiKamar.innerHTML =
                    '<div class="empty-message">Informasi kamar belum tersedia.</div>';
            }
        } else {
            informasiKamar.innerHTML =
                '<div class="empty-message">Kamu belum mendapatkan penempatan kamar.</div>';
        }

        window.idPenghuniAktif = penghuni.id;
        await muatTagihan(penghuni.id);

    } catch (error) {
        console.error('Kesalahan dashboard:', error);
        pesan.textContent = 'Gagal memuat data: ' + error.message;
    }
}

// Logout
document.getElementById('logoutButton').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        alert('Gagal logout: ' + error.message);
        return;
    }

    window.location.href = 'login.html';
});

muatDashboard();
