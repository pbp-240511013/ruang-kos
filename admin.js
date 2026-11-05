
import { supabase } from './supabase.js';

// ========================================
// 1. FUNGSI BANTU
// ========================================

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, karakter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[karakter]);
}

function formatRupiah(value) {
    return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
}

function formatBulan(value) {
    if (!value) return '-';

    const tanggal = new Date(value + 'T00:00:00');

    if (Number.isNaN(tanggal.getTime())) return value;

    return tanggal.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric'
    });
}

function tanggalHariIni() {
    const sekarang = new Date();

    return [
        sekarang.getFullYear(),
        String(sekarang.getMonth() + 1).padStart(2, '0'),
        String(sekarang.getDate()).padStart(2, '0')
    ].join('-');
}

function normalisasiStatus(status) {
    return String(status || 'aktif').trim().toLowerCase();
}


// ========================================
// 2. MEMERIKSA AKSES ADMIN
// ========================================

async function cekAdmin() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = 'login.html';
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nama, role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || profile.role !== 'admin') {
        alert('Halaman ini hanya dapat diakses oleh Admin.');
        window.location.href = 'login.html';
        return false;
    }

    document.querySelector('.admin-header p').textContent =
        'Selamat datang, ' + profile.nama + '!';

    return true;
}


// ========================================
// 3. MEMUAT DATA KAMAR
// ========================================

async function muatKamar() {
    const tabel = document.getElementById('tabelKamar');

    const { data, error } = await supabase
        .from('kamar')
        .select('*')
        .order('nomor_kamar');

    if (error) {
        tabel.innerHTML =
            `<tr><td colspan="5">Gagal memuat: ${escapeHTML(error.message)}</td></tr>`;
        return;
    }

    const kamar = data || [];

    document.getElementById('totalKamar').textContent = kamar.length;

    document.getElementById('kamarTersedia').textContent =
        kamar.filter(item => item.status === 'tersedia').length;

    document.getElementById('kamarTerisi').textContent =
        kamar.filter(item => item.status === 'terisi').length;

    if (kamar.length === 0) {
        tabel.innerHTML =
            '<tr><td colspan="5">Belum ada data kamar.</td></tr>';
    } else {
        tabel.innerHTML = kamar.map(item => `
            <tr>
                <td>${escapeHTML(item.nomor_kamar)}</td>
                <td>${escapeHTML(item.tipe_kamar)}</td>
                <td>${formatRupiah(item.harga_bulanan)}</td>
                <td>${escapeHTML(item.status)}</td>
                <td>
                    <button type="button" class="editKamar"
                        data-id="${escapeHTML(item.id)}">Edit</button>

                    <button type="button" class="hapusKamar"
                        data-id="${escapeHTML(item.id)}">Hapus</button>
                </td>
            </tr>
        `).join('');
    }

    await muatPilihanKamar();
}


// ========================================
// 4. MEMUAT DATA PENGHUNI
// ========================================

async function muatPenghuni() {
    const tabel = document.getElementById('tabelPenghuni');
    const filter = document.getElementById('filterPenghuni').value;

    const { data, error } = await supabase
        .from('penghuni')
        .select('*')
        .order('nama');

    if (error) {
        tabel.innerHTML =
            `<tr><td colspan="9">Gagal memuat: ${escapeHTML(error.message)}</td></tr>`;
        return;
    }

    const semuaPenghuni = data || [];

    const penghuniAktif = semuaPenghuni.filter(
        item => normalisasiStatus(item.status) === 'aktif'
    );

    document.getElementById('totalPenghuni').textContent =
        penghuniAktif.length;

    // Mengambil nomor kamar
    const kamarIds = [...new Set(
        semuaPenghuni.map(item => item.kamar_id).filter(Boolean)
    )];

    let daftarKamar = [];

    if (kamarIds.length > 0) {
        const { data: kamar, error: kamarError } = await supabase
            .from('kamar')
            .select('id, nomor_kamar')
            .in('id', kamarIds);

        if (!kamarError) daftarKamar = kamar || [];
    }

    const nomorKamar = new Map(
        daftarKamar.map(item => [
            String(item.id),
            item.nomor_kamar
        ])
    );

    // Filter penghuni
    let penghuni = semuaPenghuni;

    if (filter === 'aktif') {
        penghuni = semuaPenghuni.filter(
            item => normalisasiStatus(item.status) === 'aktif'
        );
    } else if (filter === 'keluar') {
        penghuni = semuaPenghuni.filter(
            item => normalisasiStatus(item.status) === 'keluar'
        );
    }

    if (penghuni.length === 0) {
        tabel.innerHTML =
            '<tr><td colspan="9">Tidak ada data penghuni.</td></tr>';
        return;
    }

    tabel.innerHTML = penghuni.map(item => {
        const aktif = normalisasiStatus(item.status) === 'aktif';

        return `
            <tr>
                <td>${escapeHTML(item.nama)}</td>
                <td>${escapeHTML(item.no_hp || '-')}</td>
                <td>${escapeHTML(item.alamat || '-')}</td>
                <td>${escapeHTML(item.tanggal_masuk || '-')}</td>
                <td>${escapeHTML(nomorKamar.get(String(item.kamar_id)) || '-')}</td>

                <td>
                    <span class="status-label ${
                        aktif ? 'status-lunas' : 'status-ditolak'
                    }">
                        ${aktif ? 'Aktif' : 'Keluar'}
                    </span>
                </td>

                <td>${escapeHTML(item.tanggal_keluar || '-')}</td>

                <td>${escapeHTML(item.keterangan_keluar || '-')}</td>

                <td>
                    ${
                        aktif
                        ? `<button type="button"
                            class="keluarkanPenghuni"
                            data-id="${escapeHTML(item.id)}"
                            data-nama="${escapeHTML(item.nama)}">
                            Pindah/Keluarkan
                           </button>`
                        : '<span class="status-label">Selesai</span>'
                    }
                </td>
            </tr>
        `;
    }).join('');
}


// ========================================
// 5. MEMUAT AKUN PENGHUNI
// ========================================

async function muatAkunPenghuni() {
    const pilihan = document.getElementById('pilihPenghuni');

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, nama, email')
        .eq('role', 'penghuni')
        .order('nama');

    if (profileError) {
        pilihan.innerHTML =
            '<option value="">Gagal memuat akun penghuni</option>';
        return;
    }

    const { data: penghuni, error: penghuniError } = await supabase
        .from('penghuni')
        .select('user_id, status');

    if (penghuniError) {
        pilihan.innerHTML =
            '<option value="">Gagal memeriksa penghuni</option>';
        return;
    }

    const akunAktif = new Set(
        (penghuni || [])
            .filter(item => normalisasiStatus(item.status) === 'aktif')
            .map(item => item.user_id)
    );

    const belumMendapatKamar = (profiles || []).filter(
        item => !akunAktif.has(item.id)
    );

    if (belumMendapatKamar.length === 0) {
        pilihan.innerHTML =
            '<option value="">Belum ada akun yang menunggu kamar</option>';
        return;
    }

    pilihan.innerHTML =
        '<option value="">Pilih akun penghuni</option>' +
        belumMendapatKamar.map(item => `
            <option value="${escapeHTML(item.id)}">
                ${escapeHTML(item.nama)} - ${escapeHTML(item.email)}
            </option>
        `).join('');
}


// ========================================
// 6. MEMUAT KAMAR TERSEDIA
// ========================================

async function muatPilihanKamar() {
    const pilihan = document.getElementById('pilihKamar');

    const { data, error } = await supabase
        .from('kamar')
        .select('id, nomor_kamar, tipe_kamar, harga_bulanan')
        .eq('status', 'tersedia')
        .order('nomor_kamar');

    if (error) {
        pilihan.innerHTML =
            '<option value="">Gagal memuat kamar</option>';
        return;
    }

    if (!data || data.length === 0) {
        pilihan.innerHTML =
            '<option value="">Tidak ada kamar tersedia</option>';
        return;
    }

    pilihan.innerHTML =
        '<option value="">Pilih kamar tersedia</option>' +
        data.map(item => `
            <option value="${escapeHTML(item.id)}">
                Kamar ${escapeHTML(item.nomor_kamar)}
                - ${escapeHTML(item.tipe_kamar)}
                (${formatRupiah(item.harga_bulanan)})
            </option>
        `).join('');
}


// ========================================
// 7. MENAMBAHKAN KAMAR
// ========================================

document.getElementById('formKamar').addEventListener(
    'submit',
    async function(event) {
        event.preventDefault();

        const form = this;
        const tombol = form.querySelector('button[type="submit"]');
        const pesan = document.getElementById('pesanKamar');

        const nomor = document.getElementById('nomorKamar').value.trim();
        const tipe = document.getElementById('tipeKamar').value.trim();
        const harga = Number(document.getElementById('hargaKamar').value);
        const status = document.getElementById('statusKamar').value;

        if (!nomor || !tipe || harga <= 0 || !status) {
            pesan.style.color = 'red';
            pesan.textContent = 'Periksa kembali data kamar.';
            return;
        }

        tombol.disabled = true;
        pesan.textContent = 'Menyimpan kamar...';

        try {
            const { error } = await supabase
                .from('kamar')
                .insert([{
                    nomor_kamar: nomor,
                    tipe_kamar: tipe,
                    harga_bulanan: harga,
                    status: status
                }]);

            if (error) throw error;

            pesan.style.color = 'green';
            pesan.textContent = 'Kamar berhasil disimpan!';

            form.reset();
            await muatKamar();

        } catch (error) {
            pesan.style.color = 'red';
            pesan.textContent = 'Gagal menyimpan: ' + error.message;
        } finally {
            tombol.disabled = false;
        }
    }
);


// ========================================
// 8. MENGEDIT KAMAR
// ========================================

document.getElementById('tabelKamar').addEventListener(
    'click',
    async function(event) {
        const tombol = event.target.closest('.editKamar');
        if (!tombol) return;

        const { data: kamar, error } = await supabase
            .from('kamar')
            .select('*')
            .eq('id', tombol.dataset.id)
            .single();

        if (error) {
            alert(error.message);
            return;
        }

        const nomor = prompt('Nomor kamar:', kamar.nomor_kamar);
        if (nomor === null) return;

        const tipe = prompt('Tipe kamar:', kamar.tipe_kamar);
        if (tipe === null) return;

        const hargaInput = prompt('Harga bulanan:', kamar.harga_bulanan);
        if (hargaInput === null) return;

        const status = prompt(
            'Status (tersedia/terisi):',
            kamar.status
        );

        if (status === null) return;

        const harga = Number(hargaInput);
        const statusBaru = status.trim().toLowerCase();

        if (
            !nomor.trim() ||
            !tipe.trim() ||
            !Number.isFinite(harga) ||
            harga <= 0 ||
            !['tersedia', 'terisi'].includes(statusBaru)
        ) {
            alert('Data kamar tidak valid.');
            return;
        }

        const { error: updateError } = await supabase
            .from('kamar')
            .update({
                nomor_kamar: nomor.trim(),
                tipe_kamar: tipe.trim(),
                harga_bulanan: harga,
                status: statusBaru
            })
            .eq('id', kamar.id);

        if (updateError) {
            alert('Gagal mengedit: ' + updateError.message);
            return;
        }

        alert('Data kamar berhasil diperbarui!');
        await muatKamar();
    }
);


// ========================================
// 9. MENGHAPUS KAMAR
// ========================================

document.getElementById('tabelKamar').addEventListener(
    'click',
    async function(event) {
        const tombol = event.target.closest('.hapusKamar');
        if (!tombol) return;

        const yakin = confirm('Yakin ingin menghapus kamar ini?');
        if (!yakin) return;

        const { data, error } = await supabase
            .from('kamar')
            .delete()
            .eq('id', tombol.dataset.id)
            .eq('status', 'tersedia')
            .select('id');

        if (error) {
            alert('Gagal menghapus kamar: ' + error.message);
            return;
        }

        if (!data || data.length === 0) {
            alert('Kamar tidak bisa dihapus karena sedang terisi atau tidak ditemukan.');
            return;
        }

        alert('Kamar berhasil dihapus!');
        await muatKamar();
    }
);


// ========================================
// 10. MENETAPKAN KAMAR
// ========================================

document.getElementById('formPenetapan').addEventListener(
    'submit',
    async function(event) {
        event.preventDefault();

        const form = this;
        const tombol = document.getElementById('tombolPenetapan');
        const pesan = document.getElementById('pesanPenetapan');

        const userId = document.getElementById('pilihPenghuni').value;
        const kamarId = document.getElementById('pilihKamar').value;
        const noHp = document.getElementById('noHpPenghuni').value.trim();
        const alamat = document.getElementById('alamatPenghuni').value.trim();
        const tanggalMasuk = document.getElementById('tanggalMasuk').value;

        if (!userId || !kamarId || !tanggalMasuk) {
            pesan.style.color = 'red';
            pesan.textContent = 'Lengkapi data penetapan kamar.';
            return;
        }

        tombol.disabled = true;
        pesan.textContent = 'Sedang menetapkan kamar...';

        let kamarSudahDikunci = false;
        let penghuniBerhasilDisimpan = false;

        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, nama, role')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;

            if (!profile || profile.role !== 'penghuni') {
                throw new Error('Akun bukan akun penghuni.');
            }

            const { data: dataLama, error: cekError } = await supabase
                .from('penghuni')
                .select('id, status, tanggal_masuk')
                .eq('user_id', userId)
                .order('tanggal_masuk', { ascending: false });

            if (cekError) throw cekError;

            const aktif = (dataLama || []).find(
                item => normalisasiStatus(item.status) === 'aktif'
            );

            if (aktif) {
                throw new Error('Akun ini masih memiliki kamar aktif.');
            }

            // Mengunci kamar agar tidak dipilih penghuni lain.
            const { data: kamarDiperbarui, error: kamarError } =
                await supabase
                    .from('kamar')
                    .update({ status: 'terisi' })
                    .eq('id', kamarId)
                    .eq('status', 'tersedia')
                    .select('id');

            if (kamarError) throw kamarError;

            if (!kamarDiperbarui || kamarDiperbarui.length === 0) {
                throw new Error('Kamar sudah tidak tersedia.');
            }

            kamarSudahDikunci = true;

            // Jika pernah keluar, gunakan kembali data penghuni terakhir.
            if (dataLama && dataLama.length > 0) {
                const riwayatTerakhir = dataLama[0];

                const { error: updatePenghuniError } = await supabase
                    .from('penghuni')
                    .update({
                        kamar_id: kamarId,
                        nama: profile.nama,
                        no_hp: noHp || null,
                        alamat: alamat || null,
                        tanggal_masuk: tanggalMasuk,
                        tanggal_keluar: null,
                        keterangan_keluar: null,
                        status: 'aktif'
                    })
                    .eq('id', riwayatTerakhir.id);

                if (updatePenghuniError) throw updatePenghuniError;

            } else {
                const { error: insertError } = await supabase
                    .from('penghuni')
                    .insert([{
                        user_id: userId,
                        kamar_id: kamarId,
                        nama: profile.nama,
                        no_hp: noHp || null,
                        alamat: alamat || null,
                        tanggal_masuk: tanggalMasuk,
                        status: 'aktif'
                    }]);

                if (insertError) throw insertError;
            }

            penghuniBerhasilDisimpan = true;

            const { error: aksesError } = await supabase
                .from('profiles')
                .update({ akses_diblokir: false })
                .eq('id', userId);

            if (aksesError) throw aksesError;

            pesan.style.color = 'green';
            pesan.textContent =
                'Kamar berhasil ditetapkan untuk ' + profile.nama + '!';

            form.reset();

            await Promise.all([
                muatKamar(),
                muatPenghuni(),
                muatAkunPenghuni(),
                muatPilihanPenghuniPembayaran()
            ]);

        } catch (error) {
            if (kamarSudahDikunci && !penghuniBerhasilDisimpan) {
                await supabase
                    .from('kamar')
                    .update({ status: 'tersedia' })
                    .eq('id', kamarId);
            }

            pesan.style.color = 'red';
            pesan.textContent =
                'Gagal menetapkan kamar: ' + error.message;

            await Promise.all([
                muatKamar(),
                muatAkunPenghuni()
            ]);

        } finally {
            tombol.disabled = false;
        }
    }
);


// ========================================
// 11. PILIHAN PENGHUNI UNTUK TAGIHAN
// ========================================

async function muatPilihanPenghuniPembayaran() {
    const pilihan = document.getElementById('penghuniPembayaran');

    const { data, error } = await supabase
        .from('penghuni')
        .select('id, nama, status')
        .order('nama');

    if (error) {
        pilihan.innerHTML =
            '<option value="">Gagal memuat penghuni</option>';
        return;
    }

    const penghuniAktif = (data || []).filter(
        item => normalisasiStatus(item.status) === 'aktif'
    );

    if (penghuniAktif.length === 0) {
        pilihan.innerHTML =
            '<option value="">Belum ada penghuni aktif</option>';
        return;
    }

    pilihan.innerHTML =
        '<option value="">Pilih penghuni</option>' +
        penghuniAktif.map(item => `
            <option value="${escapeHTML(item.id)}">
                ${escapeHTML(item.nama)}
            </option>
        `).join('');
}


// ========================================
// 12. MEMBUAT TAGIHAN
// ========================================

document.getElementById('formPembayaran').addEventListener(
    'submit',
    async function(event) {
        event.preventDefault();

        const form = this;
        const tombol = document.getElementById('tombolPembayaran');
        const pesan = document.getElementById('pesanPembayaran');

        const penghuniId =
            document.getElementById('penghuniPembayaran').value;

        const jumlah =
            Number(document.getElementById('jumlahPembayaran').value);

        const bulan =
            document.getElementById('bulanTagihan').value;

        if (!penghuniId || !Number.isFinite(jumlah) ||
            jumlah <= 0 || !bulan) {
            pesan.style.color = 'red';
            pesan.textContent = 'Periksa kembali data tagihan.';
            return;
        }

        tombol.disabled = true;
        pesan.textContent = 'Menyimpan tagihan...';

        try {
            const bulanTanggal = bulan + '-01';

            const { data: tagihanLama, error: cekError } = await supabase
                .from('pembayaran')
                .select('id')
                .eq('penghuni_id', penghuniId)
                .eq('bulan_tagihan', bulanTanggal);

            if (cekError) throw cekError;

            if (tagihanLama && tagihanLama.length > 0) {
                throw new Error('Tagihan bulan tersebut sudah ada.');
            }

            const { error } = await supabase
                .from('pembayaran')
                .insert([{
                    penghuni_id: penghuniId,
                    jumlah: jumlah,
                    bulan_tagihan: bulanTanggal,
                    status: 'belum_bayar',
                    tanggal_bayar: null
                }]);

            if (error) throw error;

            pesan.style.color = 'green';
            pesan.textContent = 'Tagihan berhasil dibuat!';

            form.reset();
            await muatPembayaran();

        } catch (error) {
            pesan.style.color = 'red';
            pesan.textContent = 'Gagal membuat tagihan: ' + error.message;
        } finally {
            tombol.disabled = false;
        }
    }
);


// ========================================
// 13. MENAMPILKAN PEMBAYARAN
// ========================================

async function muatPembayaran() {
    const tabel = document.getElementById('tabelPembayaranAdmin');

    tabel.innerHTML =
        '<tr><td colspan="8">Memuat data pembayaran...</td></tr>';

    const { data: pembayaran, error } = await supabase
        .from('pembayaran')
        .select('*')
        .order('bulan_tagihan', { ascending: false });

    if (error) {
        tabel.innerHTML =
            `<tr><td colspan="8">Gagal memuat: ${escapeHTML(error.message)}</td></tr>`;
        return;
    }

    if (!pembayaran || pembayaran.length === 0) {
        tabel.innerHTML =
            '<tr><td colspan="8">Belum ada tagihan pembayaran.</td></tr>';
        return;
    }

    const { data: penghuni, error: penghuniError } = await supabase
        .from('penghuni')
        .select('id, nama');

    if (penghuniError) {
        tabel.innerHTML =
            '<tr><td colspan="8">Gagal memuat nama penghuni.</td></tr>';
        return;
    }

    const namaPenghuni = new Map(
        (penghuni || []).map(item => [
            String(item.id),
            item.nama
        ])
    );

    const baris = await Promise.all(
        pembayaran.map(async item => {
            const nama =
                namaPenghuni.get(String(item.penghuni_id)) || 'Penghuni';

            let bukti = '<span>Belum ada bukti</span>';

            if (item.bukti_pembayaran) {
                const { data: file, error: fileError } =
                    await supabase.storage
                        .from('bukti-pembayaran')
                        .createSignedUrl(item.bukti_pembayaran, 300);

                if (!fileError && file?.signedUrl) {
                    const url = escapeHTML(file.signedUrl);

                    bukti = `
                        <a href="${url}" target="_blank"
                            rel="noopener noreferrer" class="bukti-link">
                            <img src="${url}" class="bukti-preview"
                                alt="Bukti pembayaran">
                            <br>Lihat bukti
                        </a>
                    `;
                } else {
                    bukti = '<span>Gagal memuat bukti</span>';
                }
            }

            let status = 'Belum Dibayar';
            let kelas = '';
            let aksi = 'Menunggu pembayaran';

            if (item.status === 'menunggu_verifikasi') {
                status = 'Menunggu Verifikasi';
                kelas = 'status-menunggu';

                aksi = `
                    <div class="aksi-pembayaran">
                        <button type="button"
                            class="setujuiPembayaran"
                            data-id="${escapeHTML(item.id)}">
                            Setujui
                        </button>

                        <button type="button"
                            class="tolakPembayaran"
                            data-id="${escapeHTML(item.id)}">
                            Tolak
                        </button>
                    </div>
                `;

            } else if (item.status === 'lunas') {
                status = 'Lunas';
                kelas = 'status-lunas';
                aksi = 'Selesai';

            } else if (item.status === 'ditolak') {
                status = 'Ditolak';
                kelas = 'status-ditolak';
                aksi = 'Menunggu kirim ulang';
            }

            const alasan = item.catatan_verifikasi
                ? `<div class="alasan-penolakan">
                    Alasan: ${escapeHTML(item.catatan_verifikasi)}
                   </div>`
                : '';

            return `
                <tr>
                    <td>${escapeHTML(nama)}</td>
                    <td>${escapeHTML(formatBulan(item.bulan_tagihan))}</td>
                    <td>${formatRupiah(item.jumlah)}</td>
                    <td>${escapeHTML(item.metode_pembayaran || '-')}</td>
                    <td>${bukti}</td>
                    <td>
                        <span class="status-label ${kelas}">
                            ${status}
                        </span>
                        ${alasan}
                    </td>
                    <td>${escapeHTML(item.tanggal_bayar || '-')}</td>
                    <td>${aksi}</td>
                </tr>
            `;
        })
    );

    tabel.innerHTML = baris.join('');
}


// ========================================
// 14. VERIFIKASI PEMBAYARAN
// ========================================

document.getElementById('tabelPembayaranAdmin').addEventListener(
    'click',
    async function(event) {
        const setuju = event.target.closest('.setujuiPembayaran');
        const tolak = event.target.closest('.tolakPembayaran');

        if (!setuju && !tolak) return;

        const tombol = setuju || tolak;
        const id = tombol.dataset.id;

        let updateData;

        if (setuju) {
            if (!confirm('Setujui pembayaran ini?')) return;

            updateData = {
                status: 'lunas',
                tanggal_bayar: tanggalHariIni(),
                catatan_verifikasi: null
            };

        } else {
            const alasan = prompt('Masukkan alasan penolakan:');

            if (alasan === null) return;

            if (!alasan.trim()) {
                alert('Alasan penolakan harus diisi.');
                return;
            }

            if (!confirm('Yakin ingin menolak pembayaran ini?')) return;

            updateData = {
                status: 'ditolak',
                catatan_verifikasi: alasan.trim(),
                tanggal_bayar: null
            };
        }

        tombol.disabled = true;

        const { data, error } = await supabase
            .from('pembayaran')
            .update(updateData)
            .eq('id', id)
            .eq('status', 'menunggu_verifikasi')
            .select('id');

        if (error) {
            alert('Gagal memproses pembayaran: ' + error.message);
            tombol.disabled = false;
            return;
        }

        if (!data || data.length === 0) {
            alert('Status pembayaran sudah berubah.');
            await muatPembayaran();
            return;
        }

        alert(setuju
            ? 'Pembayaran berhasil disetujui!'
            : 'Pembayaran berhasil ditolak.');

        await muatPembayaran();
    }
);


// ========================================
// 15. PENGHUNI PINDAH / KELUAR
// ========================================

document.getElementById('tabelPenghuni').addEventListener(
    'click',
    async function(event) {
        const tombol = event.target.closest('.keluarkanPenghuni');
        if (!tombol) return;

        const id = tombol.dataset.id;
        const nama = tombol.dataset.nama;

        // Meminta tanggal keluar
        const tanggalKeluar = prompt(
            `Tanggal keluar ${nama} (YYYY-MM-DD):`,
            tanggalHariIni()
        );

        if (tanggalKeluar === null) return;

        // Validasi format tanggal
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalKeluar)) {
            alert('Format tanggal harus YYYY-MM-DD.');
            return;
        }

        const [tahun, bulan, hari] =
            tanggalKeluar.split('-').map(Number);

        const tanggalValid = new Date(tahun, bulan - 1, hari);

        if (
            tanggalValid.getFullYear() !== tahun ||
            tanggalValid.getMonth() !== bulan - 1 ||
            tanggalValid.getDate() !== hari
        ) {
            alert('Tanggal keluar tidak valid.');
            return;
        }

        // Meminta keterangan
        const keterangan = prompt(
            'Keterangan keluar (contoh: pindah kos atau selesai sewa):'
        );

        if (keterangan === null) return;

        if (!confirm(
            `Yakin mengeluarkan ${nama}? Kamar akan dikosongkan dan akses akun diblokir.`
        )) return;

        tombol.disabled = true;

        try {
            // Mengambil data penghuni
            const { data: penghuni, error: ambilError } = await supabase
                .from('penghuni')
                .select('id, user_id, kamar_id, status')
                .eq('id', id)
                .single();

            if (ambilError) throw ambilError;

            if (normalisasiStatus(penghuni.status) !== 'aktif') {
                throw new Error('Penghuni sudah berstatus keluar.');
            }

            // 1. Mengubah status penghuni
            const { data: hasilUpdate, error: updateError } = await supabase
                .from('penghuni')
                .update({
                    status: 'keluar',
                    tanggal_keluar: tanggalKeluar,
                    keterangan_keluar: keterangan.trim() || null
                })
                .eq('id', id)
                .eq('status', 'aktif')
                .select('id');

            if (updateError) throw updateError;

            if (!hasilUpdate || hasilUpdate.length === 0) {
                throw new Error(
                    'Data penghuni sudah berubah atau tidak dapat diperbarui.'
                );
            }

            // 2. Mengosongkan kamar
            if (penghuni.kamar_id) {
                const { error: kamarError } = await supabase
                    .from('kamar')
                    .update({ status: 'tersedia' })
                    .eq('id', penghuni.kamar_id);

                if (kamarError) {
                    throw new Error(
                        'Status penghuni sudah keluar, tetapi kamar gagal diperbarui: ' +
                        kamarError.message
                    );
                }
            }

            // 3. Memblokir akses akun
            if (penghuni.user_id) {
                const { error: blokirError } = await supabase
                    .from('profiles')
                    .update({ akses_diblokir: true })
                    .eq('id', penghuni.user_id);

                if (blokirError) {
                    throw new Error(
                        'Status penghuni sudah keluar, tetapi pemblokiran akun gagal: ' +
                        blokirError.message
                    );
                }
            }

            alert(
                `${nama} berhasil dikeluarkan. Riwayat penghuni tetap tersimpan.`
            );

            await Promise.all([
                muatKamar(),
                muatPenghuni(),
                muatAkunPenghuni(),
                muatPilihanPenghuniPembayaran()
            ]);

        } catch (error) {
            alert('Gagal memproses: ' + error.message);

            await Promise.all([
                muatKamar(),
                muatPenghuni(),
                muatAkunPenghuni()
            ]);

        } finally {
            tombol.disabled = false;
        }
    }
);


// ========================================
// 16. FILTER DATA PENGHUNI
// ========================================

document.getElementById('filterPenghuni').addEventListener(
    'change',
    muatPenghuni
);


// ========================================
// 17. LOGOUT ADMIN
// ========================================

document.getElementById('logoutButton').addEventListener(
    'click',
    async function() {
        const { error } = await supabase.auth.signOut();

        if (error) {
            alert('Gagal logout: ' + error.message);
            return;
        }

        window.location.href = 'login.html';
    }
);


// ========================================
// 18. MENJALANKAN DASHBOARD
// ========================================

const adminValid = await cekAdmin();

if (adminValid) {
    await Promise.all([
        muatKamar(),
        muatPenghuni(),
        muatAkunPenghuni(),
        muatPilihanPenghuniPembayaran(),
        muatPembayaran()
    ]);
}
