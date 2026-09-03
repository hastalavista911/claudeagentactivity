// dashboard/src/content/helpGuide.js
//
// Content for HelpGuide.jsx -- pure data (not JSX), so the component only
// has to MAP over it, not duplicate its render structure for id/en.
// Deliberately SEPARATE from i18n/translations.js (whose content is short
// flat keys) because this is long prose per section -- easier to
// read/maintain as section objects here than split into dozens of tiny
// translation keys.
//
// Its content is deliberately REWRITTEN (not a straight copy of
// docs/usage-guide.md) so it's accurate to the app's CURRENT state -- many
// features from the 2026-09-02 session (the Insights panel, Git History
// per-commit diffs, LAN access, ServerSwitcher, RecentSessionsList,
// automated Install Hooks, etc.) had never made it into that old
// docs/usage-guide.md.
//
// `icon`: a string name (NOT a component reference) -- looked up to the
// real icon component in HelpGuide.jsx (ICON_MAP), so this data file stays
// pure data with no React/JSX import. `items` (optional, replaces plain
// `paragraphs`) is for a section whose content is a list of
// terms/questions-and-answers -- rendered as a bold label + description,
// not one long run-on paragraph (much easier to scan for quick reference).
// `navLabel`: SHORT text for the quick-nav chip -- `heading` itself is
// sometimes long (e.g. "Access from another device (LAN) and switching
// servers"), if used as-is for the chip text, 9 chips end up piling into
// several rows (user complaint, 2026-09-02). `navLabel` stays short,
// `heading` stays full and is used for the section's own title.

export const HELP_GUIDE = {
  id: {
    title: "Panduan Penggunaan",
    sections: [
      {
        heading: "Apa itu aplikasi ini?",
        navLabel: "Tentang",
        icon: "Info",
        paragraphs: [
          "AI Agent Activity Visualizer adalah dashboard yang menampilkan aktivitas Claude Code secara real-time: berkas yang dibaca, berkas yang diubah, perintah yang dijalankan, hingga saat agent sedang memproses instruksi. Seluruh aktivitas tersebut disajikan dalam bentuk lini masa visual (daftar dan graf node), bukan sekadar teks yang bergulir cepat di terminal.",
        ],
      },
      {
        heading: "Apa tujuannya?",
        navLabel: "Tujuan",
        icon: "Target",
        paragraphs: [
          "Aplikasi ini memungkinkan pengguna memantau proses kerja Claude Code secara langsung -- memahami apa yang sedang atau telah dikerjakan tanpa perlu membaca ulang riwayat terminal yang panjang, terutama saat sesi berjalan lama atau melibatkan banyak berkas sekaligus.",
          "Dashboard ini bersifat read-only secara default -- tidak pernah memengaruhi percakapan atau proses Claude Code, dan tidak pernah memanggil LLM tambahan untuk dirinya sendiri (sehingga tidak menambah biaya atau penggunaan token). Dashboard hanya menjadi kontrol aktif apabila fitur Command Approval diaktifkan secara sengaja.",
        ],
      },
      {
        heading: "Memulai dengan cepat -- mencoba tanpa Claude Code",
        navLabel: "Mulai Cepat",
        icon: "Zap",
        paragraphs: ["Cara paling sederhana untuk melihat cara kerja aplikasi sebelum menghubungkannya dengan Claude Code yang sesungguhnya:"],
        steps: [
          "Jalankan `npm run server` (Agent Server, port 4000) pada satu terminal.",
          "Jalankan `npm run dashboard` (dashboard, port 5173) pada terminal lain, lalu buka alamat yang tercetak di browser.",
          "Jalankan `npm run mock-agent` pada terminal ketiga -- ini adalah simulasi sesi tanpa memerlukan Claude Code sama sekali, dan akan mencetak sebuah session_id.",
          "Salin session_id tersebut, tempelkan ke kotak input pada dashboard, lalu klik \"Tonton sesi ini\" -- lini masa akan langsung terisi.",
        ],
      },
      {
        heading: "Menghubungkan sesi Claude Code yang sesungguhnya",
        navLabel: "Hubungkan Claude Code",
        icon: "Plug",
        paragraphs: ["Claude Code perlu didaftarkan melalui hooks-nya agar setiap peristiwa (event) dapat dikirim ke Agent Server. Terdapat dua cara:"],
        steps: [
          "Cara otomatis (disarankan): selama belum ada sesi yang dipantau, dashboard menampilkan kartu status \"Hooks Claude Code: X/Y terpasang\". Apabila belum lengkap, klik tombol \"Pasang Hooks\" -- proses selesai tanpa perlu membuka atau mengubah berkas konfigurasi secara manual.",
          "Cara manual (bagi yang memerlukan kendali penuh): daftarkan hooks/emit-event.js dan hooks/request-permission.js pada berkas ~/.claude/settings.json -- contoh konfigurasi lengkap tersedia pada hooks/settings.example.json.",
          "Setelah hooks terpasang, mulai atau lanjutkan sesi Claude Code seperti biasa, kemudian masukkan session_id sesi tersebut ke dashboard (dapat ditanyakan langsung kepada Claude Code: \"apa session_id sesi ini?\" apabila tidak diketahui).",
          "Perlu diperhatikan: hooks hanya berlaku untuk sesi yang dimulai atau dilanjutkan setelah hooks dipasang -- sesi yang sudah berjalan sebelumnya tidak akan tercatat secara retroaktif.",
        ],
      },
      {
        heading: "Membaca dashboard -- panel demi panel",
        navLabel: "Panel Dashboard",
        icon: "LayoutGrid",
        items: [
          {
            label: "Agent Overview (kiri atas)",
            text: "Kartu ringkasan statistik (jumlah proses berpikir, berkas, pemanggilan tool, hasil pengujian), serta penggunaan token dalam 5 jam terakhir. Angka ini menunjukkan jumlah pemakaian, bukan sisa kuota -- data kuota akun tidak dapat diakses dari luar.",
          },
          {
            label: "Activity Flow (tengah)",
            text: "Daftar kronologis dan graf node dari peristiwa yang sama, keduanya dapat diklik. Warna menunjukkan status: kuning berarti sedang berjalan, hijau berarti berhasil, merah berarti terjadi kesalahan. Klik salah satu aktivitas untuk menampilkan detailnya pada panel Details.",
          },
          {
            label: "Details (kanan atas)",
            text: "Diff lengkap (baris yang ditambahkan/dihapus) apabila aktivitasnya berupa penyuntingan berkas, atau keluaran (output) apabila berupa perintah terminal. Terkadang disertai catatan \"Agent Thoughts\" (teks pemikiran Claude sebelum aksi tersebut -- sering kosong, dan hal itu wajar). Tersedia tombol \"Open in VS Code\" untuk membuka baris yang diubah secara langsung.",
          },
          {
            label: "Terminal / Log Output (kiri bawah)",
            text: "Ringkasan singkat secara default; aktifkan \"Debug mode\" untuk melihat data JSON mentah dari peristiwa tersebut.",
          },
          {
            label: "Git (tengah bawah)",
            text: "Terpisah dari Activity Flow, dan bersifat murni membaca data (tidak pernah commit/push/pull/checkout/reset). Tiga tab: Status (staged/modified/untracked), History (~20 commit terakhir -- klik salah satu untuk melihat daftar berkas yang diubah, lalu klik berkas tersebut untuk melihat diff persis seperti saat commit itu dibuat), Diff (diff working-tree saat ini, muncul otomatis begitu berkas diklik di Status/History).",
          },
          {
            label: "Insights (kanan bawah)",
            text: "Empat tab: Files (berkas yang disentuh sesi ini, klik untuk menuju Activity Flow), Cost (estimasi biaya dalam dolar dari penggunaan token -- harga publik, bukan tagihan pasti), Alerts (riwayat notifikasi & keputusan permission sepanjang sesi), Tests (ringkasan PASS/FAIL apabila terdeteksi dari keluaran terminal).",
          },
          { label: "Chat (paling kanan)", text: "Dijelaskan secara terpisah pada bagian berikutnya." },
        ],
      },
      {
        heading: "Command Approval -- Off / Manual / Auto",
        navLabel: "Command Approval",
        icon: "ShieldAlert",
        paragraphs: ["Sebuah pemilih dengan tiga mode pada status bar, berlaku per sesi, dan berstatus Off secara default untuk setiap sesi:"],
        steps: [
          "Off -- dashboard tidak ikut campur sama sekali, Claude Code berjalan normal seperti biasa. Pengecualian: pada sesi chat yang dimulai langsung dari dashboard (lihat bagian Chat), Off berarti setiap permintaan otomatis ditolak -- sesi tersebut tidak punya prompt terminal sebagai fallback.",
          "Manual -- setiap permintaan Edit, Write, Bash, atau PowerShell yang hendak dijalankan Claude Code akan muncul sebagai kartu pada dashboard, dan pengguna perlu mengklik Izinkan atau Tolak. Apabila tidak dijawab dalam waktu 20 detik, permintaan tersebut secara otomatis beralih ke prompt izin bawaan Claude Code di terminal/VS Code -- dashboard hanya berfungsi sebagai jalur pintas opsional, bukan satu-satunya cara untuk merespons.",
          "Auto -- tidak pernah menjeda proses; seluruh aksi langsung dijalankan, namun tetap tercatat sebagai peristiwa dengan penanda \"AUTO\" pada Activity Flow dan tab Insights > Alerts, sehingga jejaknya tetap dapat ditelusuri.",
        ],
      },
      {
        heading: "Memulai percakapan langsung dari dashboard",
        navLabel: "Chat",
        icon: "MessageSquare",
        paragraphs: [
          "Panel Chat memungkinkan pengguna memulai sesi Claude Code yang baru secara langsung dari dashboard (tidak hanya memantau sesi yang telah berjalan) -- isikan folder proyek beserta instruksi pertama, lalu kirim. Lini masa dan balasan Claude Code akan langsung ditampilkan secara live.",
          "Perlu diperhatikan: sesi yang dimulai melalui fitur chat ini tidak memiliki mekanisme cadangan berupa prompt terminal -- apabila Command Approval berstatus Off, seluruh permintaan penyuntingan atau perintah akan otomatis ditolak. Centang opsi \"Mulai di mode Manual\" saat memulai percakapan apabila Claude Code perlu benar-benar dapat menyunting berkas atau menjalankan perintah.",
        ],
      },
      {
        heading: "Akses dari perangkat lain (LAN) dan berpindah server",
        navLabel: "LAN & Server",
        icon: "Wifi",
        paragraphs: [
          "Dashboard dapat dibuka dari perangkat lain pada jaringan lokal yang sama (ponsel, laptop lain) -- jalankan `npm run dashboard`, kemudian buka alamat berlabel \"Network:\" yang tercetak di terminal (bukan \"Local:\") dari perangkat tersebut.",
          "Untuk memantau session_id dari server atau mesin yang berbeda: klik ikon Server pada status bar, masukkan alamat IP/host tujuan, lalu pilih \"Simpan & Reload\". Ikon tersebut akan menampilkan penanda titik biru apabila sedang terhubung ke server non-default, sehingga selalu terlihat sewaktu-waktu.",
          "Apabila session_id pada server tujuan belum diketahui: selama belum ada sesi yang dipantau, dashboard akan otomatis menampilkan daftar seluruh session_id yang pernah tercatat pada server tersebut -- pengguna cukup memilih salah satunya tanpa perlu mengetahui atau menyalin ID dari tempat lain terlebih dahulu.",
        ],
      },
      {
        heading: "Tanya Jawab",
        navLabel: "FAQ",
        icon: "HelpCircle",
        items: [
          {
            label: "Apakah ini menambah penggunaan token/biaya Claude Code?",
            text: "Tidak -- dashboard hanya membaca data yang sudah tersedia (payload hooks, transcript lokal), tanpa panggilan LLM tambahan untuk dirinya sendiri.",
          },
          {
            label: "Apakah riwayat aktivitas ini dikirim kembali ke Claude Code?",
            text: "Tidak -- sifatnya murni satu arah; dashboard hanya memantau dan tidak pernah terlibat dalam percakapan atau proses penalaran Claude Code.",
          },
          {
            label: "Apabila Agent Server dimatikan, apakah riwayatnya hilang?",
            text: "Ya -- data disimpan di memori (bukan berkas), dan hal ini memang disengaja untuk pemakaian sehari-hari (memantau sesi yang sedang aktif), bukan untuk pengarsipan jangka panjang.",
          },
          {
            label: "Apakah aman apabila terdapat beberapa sesi Claude Code berjalan bersamaan?",
            text: "Ya -- dashboard hanya akan menampilkan session_id yang dimasukkan secara eksplisit oleh pengguna, dan tidak pernah menebak atau menggabungkan sesi lain.",
          },
        ],
      },
    ],
  },
  en: {
    title: "Usage Guide",
    sections: [
      {
        heading: "What is this app?",
        navLabel: "About",
        icon: "Info",
        paragraphs: [
          "AI Agent Activity Visualizer -- a dashboard that shows what Claude Code is doing in real time: files it reads, files it edits, commands it runs, even when it's just thinking -- all turned into a visual timeline (list + node graph), instead of text scrolling by quickly in a terminal.",
        ],
      },
      {
        heading: "What's the purpose?",
        navLabel: "Purpose",
        icon: "Target",
        paragraphs: [
          "So you can watch over Claude Code's shoulder while it works -- understand what it's doing/has done without re-reading a long terminal scroll, especially during a long session or one touching many files at once.",
          "This dashboard is ALWAYS read-only by default -- it never interferes with the conversation or Claude Code's process, never makes an extra LLM call for itself (so it never adds cost/tokens), and only becomes an active control if you DELIBERATELY turn on Command Approval.",
        ],
      },
      {
        heading: "Quick start -- try it without Claude Code first",
        navLabel: "Quick Start",
        icon: "Zap",
        paragraphs: ["The easiest way to see how it works before connecting a real Claude Code session:"],
        steps: [
          "Run `npm run server` (Agent Server, port 4000) in one terminal.",
          "Run `npm run dashboard` (dashboard, port 5173) in another terminal, open the printed address in your browser.",
          "Run `npm run mock-agent` in a third terminal -- a simulated session, no Claude Code needed, prints a session_id.",
          "Copy that session_id, paste it into the dashboard's box, click 'Watch this session' -- the timeline fills in immediately.",
        ],
      },
      {
        heading: "Connect a real Claude Code session",
        navLabel: "Connect Claude Code",
        icon: "Plug",
        paragraphs: ["Claude Code needs its hooks registered so its events reach the Agent Server. Two ways:"],
        steps: [
          "EASY WAY (new): while no session is being watched, the dashboard shows a status card 'Claude Code hooks: X/Y installed' -- if incomplete, click 'Install Hooks', done. No manual config file editing needed at all.",
          "MANUAL WAY (if you want full control): register hooks/emit-event.js & hooks/request-permission.js in ~/.claude/settings.json -- a full example is in hooks/settings.example.json.",
          "Once hooks are installed: start/continue a Claude Code session AS USUAL, then enter its session_id into the dashboard (just ask Claude Code directly: 'what's this session's session_id?' if unsure).",
          "IMPORTANT: hooks only apply to sessions started/continued AFTER they're installed -- a session already running before that won't be captured retroactively.",
        ],
      },
      {
        heading: "Reading the dashboard, panel by panel",
        navLabel: "Panels",
        icon: "LayoutGrid",
        items: [
          {
            label: "Agent Overview (top-left)",
            text: "Stat tiles (thinking/files/tool calls/tests), token usage over the last 5 hours (a usage figure, NOT remaining quota -- true account-wide limit data isn't accessible from outside).",
          },
          {
            label: "Activity Flow (middle)",
            text: "A chronological list + node graph of the same events, both clickable. Colors: yellow = running, green = success, red = error. Click any activity to see its detail in the Details panel.",
          },
          {
            label: "Details (top-right)",
            text: "The full diff (+/- per line) for a file edit, output for a terminal command, sometimes an 'Agent Thoughts' note (Claude's own text right before that action -- often blank, that's normal). There's an 'Open in VS Code' button to jump straight to the changed line.",
          },
          {
            label: "Terminal / Log Output (bottom-left)",
            text: "A short summary by default, flip 'Debug mode' on to see the raw JSON event.",
          },
          {
            label: "Git (bottom-middle)",
            text: "Independent of Activity Flow, PURELY read-only (never commits/pushes/pulls/checks out/resets). Three tabs: Status (staged/modified/untracked), History (last ~20 commits -- click one to expand its changed files, click a file to see the diff exactly as that commit introduced it), Diff (the current working-tree diff, shown automatically once you click a file in Status or History).",
          },
          {
            label: "Insights (bottom-right)",
            text: "4 small tabs: Files (files touched this session, click to jump to Activity Flow), Cost ($ estimate from token usage -- public list pricing, not an actual bill), Alerts (notification & permission decision history for this session), Tests (PASS/FAIL summary if detected from terminal output).",
          },
          { label: "Chat (far right)", text: "See its own section below." },
        ],
      },
      {
        heading: "Command Approval -- Off / Manual / Auto",
        navLabel: "Command Approval",
        icon: "ShieldAlert",
        paragraphs: ["A 3-mode selector in the status bar, per session, Off by default for every session:"],
        steps: [
          "OFF -- the dashboard doesn't get involved at all, Claude Code runs normally (EXCEPT for a chat session started directly from the dashboard -- see the Chat section, where Off means auto-DENY, not 'normal', since there's no terminal fallback).",
          "MANUAL -- every Edit/Write/Bash/PowerShell call Claude Code wants to run APPEARS as a card in the dashboard, you click Allow/Deny. No answer within 20 seconds -> falls back to Claude Code's own normal permission prompt in your terminal/VS Code (the dashboard is only an optional shortcut, never the only way to respond).",
          "AUTO -- never pauses, everything runs immediately -- but is still recorded as an event with an 'AUTO' badge in Activity Flow & the Insights > Alerts tab, so there's still a visible trail, not silently passing through unrecorded.",
        ],
      },
      {
        heading: "Chat directly from the dashboard",
        navLabel: "Chat",
        icon: "MessageSquare",
        paragraphs: [
          "The Chat panel can START a brand-new Claude Code session right from the dashboard (not just watch one already running) -- fill in a project folder + first instruction, submit, and the timeline & Claude Code's reply stream in live.",
          "IMPORTANT: sessions started this way have NO terminal prompt to fall back to -- if Command Approval is Off, EVERY edit/command is automatically DENIED. Check 'Start in Manual mode' when starting the chat if you want Claude Code to actually be able to edit/run anything.",
        ],
      },
      {
        heading: "Access from other devices (LAN) & switching servers",
        navLabel: "LAN & Server",
        icon: "Wifi",
        paragraphs: [
          "The dashboard can be opened from other devices on the same local network (phone, another laptop) -- run `npm run dashboard`, then open the 'Network:' address printed in the terminal (not 'Local:') from that device.",
          "Want to watch a session_id from a DIFFERENT server/machine? Click the Server icon in the status bar, enter the target IP/host, 'Save & Reload'. That icon gets a small blue dot whenever you're connected to a non-default server, so it stays visible at a glance anytime.",
          "Don't know what session_id exists on the target server? While nothing is being watched, the dashboard automatically shows a list of every session_id that server has ever seen -- just click one, no need to know/copy an ID from anywhere else first.",
        ],
      },
      {
        heading: "FAQ",
        navLabel: "FAQ",
        icon: "HelpCircle",
        items: [
          {
            label: "Does this add to my Claude Code token usage/cost?",
            text: "No -- the dashboard only reads data that already exists (hook payloads, local transcripts), no extra LLM call of any kind just to power itself.",
          },
          {
            label: "Is this activity history ever sent back to Claude Code?",
            text: "No -- purely one-way, the dashboard only watches, it never participates in the conversation or Claude Code's reasoning.",
          },
          {
            label: "If the Agent Server is shut down, is the history lost?",
            text: "Yes -- it's kept in memory (not a file), deliberately for day-to-day use (watching an actively running session), not long-term archiving.",
          },
          {
            label: "Is it safe with several Claude Code sessions running at once?",
            text: "Yes -- the dashboard only ever displays a session_id you explicitly entered yourself, it never guesses or merges in another session.",
          },
        ],
      },
    ],
  },
};
