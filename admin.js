import { supabase } from './supabase.js';

// ==================================
// 1. FUNGSI BANTU
// ==================================

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

    const tahun = sekarang.getFullYear();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, '0');
    const hari = String(sekarang.getDate()).padStart(2, '0');

    return `${tahun}-${bulan}-${hari}`;
}


// ==================================
// 2. MEMERIKSA AKSES ADMIN
// ==================================

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


// ==================================
// 3. MENAMPILKAN DATA KAMAR
// ==================================

async function muatKamar() {
    const tabel = document.getElementById('tabelKamar');

    const { data, error } = await supabase
        .from('kamar')
        .select('*')
        .order('nomor_kamar');

    if (error) {
        console.error('Gagal memuat kamar:', error.message);
        tabel.innerHTML =
            `<tr><td colspan="5">Gagal memuat data kamar: ${escapeHTML(error.message)}</td></tr>`;
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
                    <button type="button"
                        class="editKamar"
                        data-id="${escapeHTML(item.id)}">
                        Edit
                    </button>

                    <button type="button"
                        class="hapusKamar"
                        data-id="${escapeHTML(item.id)}">
                        Hapus
                    </button>
                </td>
            </tr>
        `).join('');
    }

    await muatPilihanKamar();
}


// ==================================
// 4. MENAMPILKAN DATA PENGHUNI
// ==================================

async function muatPenghuni() {
    const tabel = document.getElementById('tabelPenghuni');

    const { data, error } = await supabase
        .from('penghuni')
        .select('*')
        .order('nama');

    if (error) {
        console.error('Gagal memuat penghuni:', error.message);
        tabel.innerHTML =
            `<tr><td colspan="4">Gagal memuat data penghuni: ${escapeHTML(error.message)}</td></tr>`;
        return;
    }

    const penghuni = data || [];

    document.getElementById('totalPenghuni').textContent =
        penghuni.length;

    if (penghuni.length === 0) {
        tabel.innerHTML =
            '<tr><td colspan="4">Belum ada data penghuni.</td></tr>';
        return;
    }

    tabel.innerHTML = penghuni.map(item => `
        <tr>
            <td>${escapeHTML(item.nama)}</td>
            <td>${escapeHTML(item.no_hp || '-')}</td>
            <td>${escapeHTML(item.alamat || '-')}</td>
            <td>${escapeHTML(item.tanggal_masuk || '-')}</td>
        </tr>
    `).join('');
}


// ==================================
// 5. MEMUAT AKUN PENGHUNI
//    YANG BELUM MENDAPAT KAMAR
// ==================================

async function muatAkunPenghuni() {
    const pilihan = document.getElementById('pilihPenghuni');

    pilihan.innerHTML =
        '<option value="">Memuat akun penghuni...</option>';

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, nama, email')
        .eq('role', 'penghuni')
        .order('nama');

    if (profileError) {
        console.error(profileError.message);
        pilihan.innerHTML =
            '<option value="">Gagal memuat akun penghuni</option>';
        return;
    }

    const { data: penghuni, error: penghuniError } = await supabase
        .from('penghuni')
        .select('user_id');

    if (penghuniError) {
        console.error(penghuniError.message);
        pilihan.innerHTML =
            '<option value="">Gagal memeriksa data penghuni</option>';
        return;
    }

    const sudahTerdaftar = new Set(
        (penghuni || []).map(item => item.user_id)
    );

    const belumMendapatKamar = (profiles || []).filter(
        item => !sudahTerdaftar.has(item.id)
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


// ==================================
// 6. MEMUAT PILIHAN KAMAR TERSEDIA
// ==================================

async function muatPilihanKamar() {
    const pilihan = document.getElementById('pilihKamar');

    const { data, error } = await supabase
        .from('kamar')
        .select('id, nomor_kamar, tipe_kamar, harga_bulanan')
        .eq('status', 'tersedia')
        .order('nomor_kamar');

    if (error) {
        console.error(error.message);
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


// ==================================
// 7. MENAMBAHKAN KAMAR
// ==================================

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

        if (!nomor || !tipe || !Number.isFinite(harga) ||
            harga <= 0 || !status) {
            pesan.style.color = 'red';
            pesan.textContent = 'Periksa kembali data kamar.';
            return;
        }

        tombol.disabled = true;
        pesan.style.color = '#765c48';
        pesan.textContent = 'Menyimpan data kamar...';

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


// ==================================
// 8. MENGEDIT DATA KAMAR
// ==================================

document.getElementById('tabelKamar').addEventListener(
    'click',
    async function(event) {
        const tombol = event.target.closest('.editKamar');

        if (!tombol) return;

        const id = tombol.dataset.id;

        const { data: kamar, error: ambilError } = await supabase
            .from('kamar')
            .select('*')
            .eq('id', id)
            .single();

        if (ambilError) {
            alert('Gagal mengambil data kamar: ' + ambilError.message);
            return;
        }

        const nomor = prompt('Masukkan nomor kamar:', kamar.nomor_kamar);
        if (nomor === null) return;

        const tipe = prompt('Masukkan tipe kamar:', kamar.tipe_kamar);
        if (tipe === null) return;

        const hargaInput = prompt(
            'Masukkan harga bulanan:',
            kamar.harga_bulanan
        );
        if (hargaInput === null) return;

        const status = prompt(
            'Masukkan status (tersedia atau terisi):',
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
            alert('Data tidak valid. Silakan periksa kembali.');
            return;
        }

        const { error } = await supabase
            .from('kamar')
            .update({
                nomor_kamar: nomor.trim(),
                tipe_kamar: tipe.trim(),
                harga_bulanan: harga,
                status: statusBaru
            })
            .eq('id', id);

        if (error) {
            alert('Gagal mengedit kamar: ' + error.message);
            return;
        }

        alert('Data kamar berhasil diperbarui!');
        await muatKamar();
    }
);


// ==================================
// 9. MENGHAPUS DATA KAMAR
// ==================================

document.getElementById('tabelKamar').addEventListener(
    'click',
    async function(event) {
        const tombol = event.target.closest('.hapusKamar');

        if (!tombol) return;

        const id = tombol.dataset.id;

        const yakin = confirm('Yakin ingin menghapus kamar ini?');
        if (!yakin) return;

        tombol.disabled = true;

        const { error } = await supabase
            .from('kamar')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Gagal menghapus kamar: ' + error.message);
            tombol.disabled = false;
            return;
        }

        alert('Kamar berhasil dihapus!');
        await muatKamar();
    }
);


// ==================================
// 10. MENETAPKAN KAMAR UNTUK PENGHUNI
// ==================================

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
            pesan.textContent =
                'Pilih penghuni, kamar, dan tanggal masuk.';
            return;
        }

        tombol.disabled = true;
        pesan.style.color = '#765c48';
        pesan.textContent = 'Sedang menetapkan kamar...';

        let kamarSudahDikunci = false;
        let penghuniBaruId = null;

        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, nama, role')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;

            if (!profile || profile.role !== 'penghuni') {
                throw new Error('Akun yang dipilih bukan akun penghuni.');
            }

            const { data: dataLama, error: cekPenghuniError } =
                await supabase
                    .from('penghuni')
                    .select('id')
                    .eq('user_id', userId);

            if (cekPenghuniError) throw cekPenghuniError;

            if (dataLama && dataLama.length > 0) {
                throw new Error('Akun ini sudah memiliki data penghuni.');
            }

            const { data: kamarDiperbarui, error: updateKamarError } =
                await supabase
                    .from('kamar')
                    .update({ status: 'terisi' })
                    .eq('id', kamarId)
                    .eq('status', 'tersedia')
                    .select('id');

            if (updateKamarError) throw updateKamarError;

            if (!kamarDiperbarui || kamarDiperbarui.length === 0) {
                throw new Error(
                    'Kamar sudah tidak tersedia. Silakan pilih kamar lain.'
                );
            }

            kamarSudahDikunci = true;

            const { data: dataPenghuni, error: insertError } = await supabase
                .from('penghuni')
                .insert([{
                    user_id: userId,
                    kamar_id: kamarId,
                    nama: profile.nama,
                    no_hp: noHp || null,
                    alamat: alamat || null,
                    tanggal_masuk: tanggalMasuk
                }])
                .select('id')
                .single();

            if (insertError) throw insertError;

            penghuniBaruId = dataPenghuni.id;

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
            if (kamarSudahDikunci && !penghuniBaruId) {
                const { error: rollbackError } = await supabase
                    .from('kamar')
                    .update({ status: 'tersedia' })
                    .eq('id', kamarId);

                if (rollbackError) {
                    console.error(
                        'Gagal mengembalikan status kamar:',
                        rollbackError.message
                    );
                }
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


// ==================================
// 11. MEMUAT PILIHAN PENGHUNI
//     UNTUK TAGIHAN
// ==================================

async function muatPilihanPenghuniPembayaran() {
    const pilihan = document.getElementById('penghuniPembayaran');

    const { data, error } = await supabase
        .from('penghuni')
        .select('id, nama')
        .order('nama');

    if (error) {
        console.error(error.message);
        pilihan.innerHTML =
            '<option value="">Gagal memuat penghuni</option>';
        return;
    }

    if (!data || data.length === 0) {
        pilihan.innerHTML =
            '<option value="">Belum ada penghuni</option>';
        return;
    }

    pilihan.innerHTML =
        '<option value="">Pilih penghuni</option>' +
        data.map(item => `
            <option value="${escapeHTML(item.id)}">
                ${escapeHTML(item.nama)}
            </option>
        `).join('');
}


// ==================================
// 12. MEMBUAT TAGIHAN
// ==================================

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
        pesan.style.color = '#765c48';
        pesan.textContent = 'Menyimpan tagihan...';

        try {
            const bulanTanggal = `${bulan}-01`;

            // Cegah tagihan ganda untuk penghuni dan bulan yang sama.
            const { data: tagihanLama, error: cekError } = await supabase
                .from('pembayaran')
                .select('id')
                .eq('penghuni_id', penghuniId)
                .eq('bulan_tagihan', bulanTanggal);

            if (cekError) throw cekError;

            if (tagihanLama && tagihanLama.length > 0) {
                throw new Error(
                    'Tagihan untuk penghuni dan bulan tersebut sudah ada.'
                );
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
            pesan.textContent =
                'Gagal membuat tagihan: ' + error.message;

        } finally {
            tombol.disabled = false;
        }
    }
);


// ==================================
// 13. MENAMPILKAN DAFTAR TAGIHAN
//     TERMASUK BUKTI PEMBAYARAN
// ==================================

async function muatPembayaran() {
    const tabel = document.getElementById('tabelPembayaranAdmin');

    tabel.innerHTML =
        '<tr><td colspan="8">Memuat data pembayaran...</td></tr>';

    const { data: pembayaran, error } = await supabase
        .from('pembayaran')
        .select('*')
        .order('bulan_tagihan', { ascending: false });

    if (error) {
        console.error('Gagal memuat pembayaran:', error.message);

        tabel.innerHTML = `
            <tr>
                <td colspan="8">
                    Gagal memuat pembayaran:
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
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
        console.error(penghuniError.message);

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

            let tampilanBukti = '<span>Belum ada bukti</span>';

            // Buat URL sementara untuk file di bucket privat.
            if (item.bukti_pembayaran) {
                const { data: file, error: fileError } =
                    await supabase.storage
                        .from('bukti-pembayaran')
                        .createSignedUrl(item.bukti_pembayaran, 300);

                if (fileError) {
                    console.error(
                        'Gagal membuka bukti pembayaran:',
                        fileError.message
                    );

                    tampilanBukti =
                        '<span>Gagal memuat bukti</span>';
                } else if (file?.signedUrl) {
                    const url = escapeHTML(file.signedUrl);

                    tampilanBukti = `
                        <a href="${url}" target="_blank"
                            rel="noopener noreferrer"
                            class="bukti-link"
                            title="Klik untuk melihat bukti ukuran penuh">
                            <img src="${url}"
                                class="bukti-preview"
                                alt="Bukti pembayaran">
                            <br>Lihat bukti
                        </a>
                    `;
                }
            }

            let statusTeks = 'Belum Dibayar';
            let statusClass = '';
            let aksi = ' - ';

            if (item.status === 'menunggu_verifikasi') {
                statusTeks = 'Menunggu Verifikasi';
                statusClass = 'status-menunggu';

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
                statusTeks = 'Lunas';
                statusClass = 'status-lunas';
                aksi = 'Selesai';

            } else if (item.status === 'ditolak') {
                statusTeks = 'Ditolak';
                statusClass = 'status-ditolak';
                aksi = 'Menunggu kirim ulang';

            } else if (item.status === 'belum_bayar') {
                statusTeks = 'Belum Dibayar';
                aksi = 'Menunggu pembayaran';
            }

            const alasan = item.catatan_verifikasi
                ? `<div class="alasan-penolakan">
                    Alasan: ${escapeHTML(item.catatan_verifikasi)}
                   </div>`
                : '';

            return `
                <tr>
                    <td>${escapeHTML(nama)}</td>

                    <td>
                        ${escapeHTML(formatBulan(item.bulan_tagihan))}
                    </td>

                    <td>${formatRupiah(item.jumlah)}</td>

                    <td>
                        ${escapeHTML(item.metode_pembayaran || '-')}
                    </td>

                    <td>${tampilanBukti}</td>

                    <td>
                        <span class="status-label ${statusClass}">
                            ${statusTeks}
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


// ==================================
// 14. MENYETUJUI ATAU MENOLAK
//     PEMBAYARAN
// ==================================

document.getElementById('tabelPembayaranAdmin').addEventListener(
    'click',
    async function(event) {
        const tombolSetuju = event.target.closest('.setujuiPembayaran');
        const tombolTolak = event.target.closest('.tolakPembayaran');

        if (!tombolSetuju && !tombolTolak) return;

        const tombol = tombolSetuju || tombolTolak;
        const id = tombol.dataset.id;

        if (tombolSetuju) {
            const yakin = confirm(
                'Apakah bukti pembayaran ini sudah benar dan pembayaran diterima?'
            );

            if (!yakin) return;

            tombol.disabled = true;

            const { data, error } = await supabase
                .from('pembayaran')
                .update({
                    status: 'lunas',
                    tanggal_bayar: tanggalHariIni(),
                    catatan_verifikasi: null
                })
                .eq('id', id)
                .eq('status', 'menunggu_verifikasi')
                .select('id');

            if (error) {
                alert('Gagal menyetujui pembayaran: ' + error.message);
                tombol.disabled = false;
                return;
            }

            if (!data || data.length === 0) {
                alert(
                    'Pembayaran tidak dapat diproses. Statusnya mungkin sudah berubah.'
                );
                await muatPembayaran();
                return;
            }

            alert('Pembayaran berhasil disetujui!');
            await muatPembayaran();
            return;
        }

        if (tombolTolak) {
            const alasan = prompt(
                'Masukkan alasan penolakan pembayaran:'
            );

            if (alasan === null) return;

            if (!alasan.trim()) {
                alert('Alasan penolakan harus diisi.');
                return;
            }

            const yakin = confirm(
                'Yakin ingin menolak bukti pembayaran ini?'
            );

            if (!yakin) return;

            tombol.disabled = true;

            const { data, error } = await supabase
                .from('pembayaran')
                .update({
                    status: 'ditolak',
                    catatan_verifikasi: alasan.trim(),
                    tanggal_bayar: null
                })
                .eq('id', id)
                .eq('status', 'menunggu_verifikasi')
                .select('id');

            if (error) {
                alert('Gagal menolak pembayaran: ' + error.message);
                tombol.disabled = false;
                return;
            }

            if (!data || data.length === 0) {
                alert(
                    'Pembayaran tidak dapat diproses. Statusnya mungkin sudah berubah.'
                );
                await muatPembayaran();
                return;
            }

            alert('Pembayaran berhasil ditolak.');
            await muatPembayaran();
        }
    }
);


// ==================================
// 15. LOGOUT ADMIN
// ==================================

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


// ==================================
// 16. MENJALANKAN DASHBOARD
// ==================================

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