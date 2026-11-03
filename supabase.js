
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Konfigurasi Supabase
const SUPABASE_URL = 'https://hsfgbtsnibhohlhzbghm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aQ-Z9BcQXMjoSVuBeWKmIQ_oQV-B5DT';

// Membuat koneksi
export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log('RuangKos berhasil menginisialisasi Supabase!');
