# Jalan Warga

Game edukasi Pancasila, hukum, dan politik (kelas 9). Situs statis untuk GitHub Pages.

## Menjalankan di GitHub Pages
1. Upload semua file ini ke repositori (struktur folder dipertahankan).
2. Settings > Pages > Deploy from a branch > `main` / root.
3. Buka URL yang diberikan GitHub.

## Mode demo vs server
`config.js` berisi `API_URL`. Kosong = mode demo (tanpa kata sandi, data di peramban).
Isi dengan URL Web App Apps Script untuk login, log, dan papan peringkat sungguhan.

## Kontrak API (untuk backend Apps Script)
POST (body JSON, tanpa header khusus) dengan field `action`:
`register`, `login` (username, password) -> `{ok, username, token}`;
`log` (token, pertanyaan, jawaban, efek, skor); `finish` (token, ending, skor, flags);
`leaderboard` -> `{ok, rows:[{username, endings, best}]}`.
Gagal: `{ok:false, error:"pesan"}`.

## Mengubah cerita
Edit `data/story.json` saja (keputusan, efek P/K/R/H, flag, ending).
