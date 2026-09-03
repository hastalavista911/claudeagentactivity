// dashboard/src/i18n/translations.js
//
// Translation dictionary, one flat object per language (dot-path key ->
// string). "id" (Indonesian) is this dashboard's original language -- when
// adding a new UI string, fill it in here first, then translate it to "en".
// Placeholders use {{name}}, substituted by lib/i18n.js via
// t(key, { name: ... }).

export const LOCALES = [
  { code: "id", label: "Bahasa Indonesia" },
  { code: "en", label: "English" },
];

export const DEFAULT_LOCALE = "id";

export const translations = {
  id: {
    "common.appTitle": "AI Agent Activity Visualizer",
    "common.dash": "—",
    "common.close": "Tutup",
    "appPreloader.text": "Menyiapkan sesi terakhir…",
    "statusBar.help.tooltip": "Panduan penggunaan",
    "statusBar.help.label": "Bantuan",

    // StatusBar
    "statusBar.connection.idle": "Belum connect",
    "statusBar.connection.connecting": "Menghubungkan…",
    "statusBar.connection.open": "Terhubung",
    "statusBar.connection.closed": "Terputus — mencoba lagi…",
    "statusBar.connection.error": "Error koneksi",
    "statusBar.exportReport": "Export Report",
    "statusBar.picker.watching": "🔒 Menonton",
    "statusBar.picker.changeSession": "Ganti sesi",
    "statusBar.picker.stopWatching": "Berhenti menonton",
    "statusBar.picker.switchTo": "Ganti ke sesi lain:",
    "statusBar.picker.notFound": "Session_id tidak ditemukan/belum ada data -- coba lagi:",
    "statusBar.picker.noSession": "Belum ada sesi dipilih",
    "statusBar.picker.placeholder": "Paste session_id Claude Code di sini…",
    "statusBar.picker.watchButton": "Tonton sesi ini",
    "statusBar.picker.cancel": "Batal",
    "statusBar.picker.watchLatest": "Tonton sesi terbaru",
    "statusBar.picker.noLatestSession": "Belum ada sesi yang tercatat di server sama sekali.",

    // RecentSessionsList
    "recentSessions.title": "Sesi di server ini",
    "recentSessions.events": "event",
    "recentSessions.empty": "Belum ada session_id yang tercatat di server ini sama sekali.",
    "recentSessions.clearTooltip": "Hapus sesi ini dari server",
    "recentSessions.clearLabel": "Hapus sesi ini",
    "recentSessions.confirmDelete": "Hapus sesi ini dari server? (transkrip asli di disk tidak terpengaruh)",
    "recentSessions.confirmDeleteCurrent": "Hapus sesi ini dari server? Kamu sedang menonton sesi ini -- setelah dihapus, kamu otomatis berhenti menonton.",
    "recentSessions.confirmDeleteYes": "Ya, hapus",
    "recentSessions.confirmDeleteCancel": "Batal",
    "recentSessions.watchingBadge": "sedang ditonton",

    // SetupHooksCard
    "setup.hooks.installed": "Hooks Claude Code sudah terpasang.",
    "setup.hooks.justInstalled": "Hooks terpasang! Mulai/lanjutkan sesi Claude Code baru supaya berlaku.",
    "setup.hooks.missing": "Hooks Claude Code: {{done}}/{{total}} terpasang.",
    "setup.hooks.installButton": "Pasang Hooks",
    "setup.hooks.installing": "Memasang…",
    "statusBar.approval.label": "Command Approval",
    "statusBar.approval.mode.off": "Off",
    "statusBar.approval.mode.manual": "Manual",
    "statusBar.approval.mode.auto": "Auto",
    "statusBar.approval.tooltip.off": "Dashboard tidak ikut campur -- Claude Code jalan normal.",
    // Different from the regular tooltip.off: a chat session started from
    // the dashboard has NO terminal to fall back to, so "Off" here doesn't
    // mean "runs normally" -- it means EVERY tool call is auto-DENIED. Used
    // by ApprovalModeSelector.jsx only when the session being watched is
    // detected as a dashboard chat session (has a chat.message event).
    "statusBar.approval.tooltip.offChat": "Sesi chat ini TIDAK PUNYA fallback terminal -- Off berarti semua tool call otomatis DITOLAK, bukan berjalan normal.",
    "statusBar.approval.tooltip.manual":
      "Tiap edit file & command butuh Izinkan/Tolak dari dashboard. Maks 20 detik, lalu fallback ke prompt biasa atau otomatis ditolak.",
    "statusBar.approval.tooltip.auto":
      "Semua langsung jalan tanpa nunggu persetujuan -- tetap tercatat di Activity Flow dengan label AUTO.",
    "statusBar.approval.confirmAuto.text":
      "Aktifkan mode Auto? Setiap edit file & command dari Claude Code akan langsung dijalankan tanpa persetujuan -- gunakan hanya untuk sesi yang benar-benar Anda percaya.",
    "statusBar.approval.confirmAuto.confirm": "Ya, aktifkan Auto",
    "statusBar.approval.confirmAuto.cancel": "Batal",
    "statusBar.language.label": "Bahasa",

    // ServerSwitcher -- change which Agent Server to talk to, no Vite restart
    "serverSwitcher.tooltip": "Agent Server saat ini: {{current}} -- klik untuk mengganti",
    "serverSwitcher.current": "Server saat ini:",
    "serverSwitcher.label": "Ganti ke host/IP lain",
    "serverSwitcher.placeholder": "mis. 192.168.1.50 atau 192.168.1.50:4000",
    "serverSwitcher.hint": "Halaman akan reload untuk menerapkan perubahan ini (bukan restart server dev, yang tetap berjalan).",
    "serverSwitcher.apply": "Simpan & Reload",
    "serverSwitcher.reset": "Reset ke default",
    "serverSwitcher.defaultLabel": "default (otomatis)",
    "serverSwitcher.connected": "Terhubung ke server: {{host}}",
    "serverSwitcher.connectedHint": "Kalau session_id lama muncul \"tidak ditemukan\", itu wajar -- masukkan session_id yang berlaku untuk server ini.",
    "serverSwitcher.checking": "Mengecek...",
    "serverSwitcher.checkFailed": "Tidak bisa terhubung ke {{host}}. Pastikan Agent Server berjalan di alamat tersebut dan portnya benar (default 4000), lalu coba lagi.",
    "serverSwitcher.advancedTitle": "Fitur lanjutan",
    "serverSwitcher.advancedHint":
      "Hanya diperlukan jika Agent Server berjalan di perangkat lain (misalnya diakses lewat jaringan lokal). Untuk pemakaian di satu komputer yang sama, biarkan pada pengaturan default -- tidak perlu diubah.",

    // Legend
    "legend.toggle": "Keterangan",
    "scrollToTop.label": "Scroll ke atas",
    "legend.colorTitle": "Arti Warna",
    "legend.iconTitle": "Arti Icon",
    "legend.color.running": "Sedang berjalan (running)",
    "legend.color.success": "Selesai / berhasil (done)",
    "legend.color.error": "Error / gagal",
    "legend.color.info": "Info / idle",
    "legend.icon.agent": "Aksi agent (start, thinking, complete)",
    "legend.icon.file": "File (baca/edit)",
    "legend.icon.terminal": "Command terminal",
    "legend.icon.chat": "Pesan chat",

    // OverviewPanel
    "overview.title": "Agent Overview",
    "overview.idle.label": "Idle",
    "overview.idle.sub": "Tidak ada aksi yang sedang berjalan",
    "overview.elapsed": "Elapsed",
    "overview.stat.thinking": "Thinking",
    "overview.stat.files": "Files",
    "overview.stat.toolCalls": "Tool Calls",
    "overview.stat.tests": "Tests",
    "overview.stat.tokens": "Tokens",
    "overview.stat.model": "Model",
    "overview.tokenUsage.title": "Token Usage (5 jam terakhir)",
    "overview.tokenUsage.messages": "{{count}} pesan asisten",
    "overview.tokenUsage.caption":
      "Dari sesi ini saja (session_id yang sedang ditonton) — bukan total kuota akun kamu. " +
      "Kalau ada sesi Claude Code lain jalan bersamaan, itu tidak ikut terhitung di sini.",
    "overview.tokenUsage.empty": "Belum ada aktivitas 5 jam terakhir.",
    "overview.waiting": "Menunggu data transcript…",
    "overview.summary.title": "Session Summary",
    "overview.summary.badge": "COMPLETE",
    "overview.summary.duration": "Total Duration",
    "overview.summary.toolCalls": "Tool Calls",
    "overview.summary.filesChanged": "Files Changed",
    "overview.summary.tokensUsed": "Tokens Used",
    "overview.summary.outcome": "Outcome",
    "overview.summary.success": "Success",
    "overview.summary.finishedAt": "Finished at {{time}}",

    // Activity labels -- used by OverviewPanel & ChatPanel (one single source of truth)
    "activity.editing": "Editing File",
    "activity.terminal": "Running Command",
    "activity.thinking": "Thinking",

    // ActivityFlowPanel
    "activityFlow.title": "Activity Flow",
    "activityFlow.live": "Live",
    "activityFlow.searchPlaceholder": "Cari aktivitas…",
    "activityFlow.filter.all": "Semua",
    "activityFlow.filter.thinking": "Thinking",
    "activityFlow.filter.run": "Run",
    "activityFlow.filter.complete": "Complete",
    "activityFlow.filter.error": "Error",
    "activityFlow.list.empty": "Tidak ada aktivitas yang cocok.",
    "activityFlow.current": "current",
    "activityFlow.selected": "dipilih",
    "activityFlow.stillWorking": "masih berjalan…",
    "activityFlow.emptyGraphPrefix": "Masukkan",
    "activityFlow.emptyGraphSuffix": "pada kolom di atas untuk mulai menonton — dashboard tidak akan memilih sesi mana pun secara otomatis.",
    "activityFlow.emptyLoading": "Memeriksa sesi…",
    "activityFlow.emptyInvalidPrefix": "Belum ada data untuk session_id",
    "activityFlow.emptyInvalidSuffix":
      "— cek lagi apakah session_id-nya benar, atau tunggu Claude Code (dengan hooks terpasang) mengirim event pertamanya.",

    // Event labels (describeEvent) -- used by the list & graph
    "event.agentStart": "Agent Start",
    "event.thinking": "Thinking…",
    "event.complete": "Complete",
    "event.error": "Error",
    "event.notification": "Notification",
    "event.userMessage": "Pesan Kamu",
    "event.assistantReply": "Balasan Claude",
    "event.read": "Read",
    "event.editing": "Editing…",
    "event.edited": "Edited",
    "event.run": "Run",
    "event.output": "Output",
    "event.terminalDone": "Terminal Done",
    "event.autoApproved": "Disetujui Otomatis",
    "event.autoBadge": "AUTO",
    "event.decidedAllow": "Diizinkan (Manual)",
    "event.decidedDeny": "Ditolak (Manual)",

    // DetailsPanel
    "details.title": "Details",
    "details.empty": "Klik salah satu event di Activity Flow untuk lihat detail.",
    "details.field.file": "File",
    "details.field.command": "Command",
    "details.field.category": "Category",
    "details.field.reason": "Reason",
    "details.field.message": "Message",
    "details.field.status": "Status",
    "details.field.duration": "Duration",
    "details.field.lines": "Lines",
    "details.field.changes": "Changes",
    "details.agentThoughts": "Agent Thoughts",
    "details.diffPreview": "Diff Preview",
    "details.output": "Output",
    "details.openInVSCode": "Open in VS Code",
    "details.openInVSCodeTitle": "Buka file ini di VS Code (butuh VS Code terinstal & terdaftar sebagai handler vscode://)",

    // TerminalLogPanel
    "terminal.title": "Terminal / Log Output",
    "terminal.debugMode": "Debug mode",
    "terminal.debugTooltip": "ON: tampilkan raw JSON event apa adanya (untuk debugging). OFF: ringkasan singkat saja.",
    "terminal.empty": "Belum ada output terminal di sesi ini.",
    "terminal.concise.tool": "Tool",
    "terminal.concise.command": "Command",
    "terminal.concise.file": "File",
    "terminal.concise.status": "Status",
    "terminal.concise.statusError": "Error",
    "terminal.concise.statusSuccess": "Selesai",
    "terminal.concise.statusRunning": "Berjalan",

    // InsightsPanel -- used to be an empty slot (PlaceholderPanel), now 4
    // small tabs (Files/Cost/Alerts/Tests), all purely derived from the
    // events/usage already in the store.
    "insights.title": "Insights",
    "insights.noSession": "Belum ada sesi yang ditonton.",
    "insights.tab.files": "Files",
    "insights.tab.cost": "Cost",
    "insights.tab.alerts": "Alerts",
    "insights.tab.tests": "Tests",
    "insights.files.empty": "Belum ada file yang diedit di sesi ini.",
    "insights.files.editsCount": "{{count}}x edit",
    "insights.cost.empty": "Belum ada data token usage.",
    "insights.cost.disclaimer": "Estimasi dari harga list publik, bukan tagihan pasti akun kamu.",
    "insights.cost.input": "Input",
    "insights.cost.output": "Output",
    "insights.cost.cacheWrite": "Cache write",
    "insights.cost.cacheRead": "Cache read",
    "insights.alerts.empty": "Belum ada notifikasi atau keputusan permission di sesi ini.",
    "insights.tests.empty": "Tidak ada ringkasan test yang terdeteksi dari output terminal.",
    "insights.tests.passed": "{{count}} passed",
    "insights.tests.failed": "{{count}} failed",
    "insights.tests.caption": "Terdeteksi dari format output {{source}} (best-effort, bisa saja salah baca).",

    // GitPanel
    "git.title": "Git",
    "git.tab.status": "Status",
    "git.tab.diff": "Diff",
    "git.tab.history": "History",
    "git.noRoot": "Belum ada file/sesi aktif untuk ditentukan project-nya.",
    "git.status.loading": "Memuat status git…",
    "git.status.notRepo": "Folder ini bukan bagian dari git repo.",
    "git.status.clean": "Tidak ada perubahan -- working tree bersih.",
    "git.status.caption": "Belum di-commit. M = isi berubah, D = file dihapus.",
    "git.status.staged": "Staged",
    "git.status.modified": "Modified",
    "git.status.untracked": "Untracked",
    "git.diff.selectHint": "Klik salah satu file di tab Status untuk lihat diff-nya.",
    "git.diff.loading": "Memuat diff…",
    "git.diff.none": "Tidak ada diff untuk {{file}} (file baru/untracked tidak punya baseline untuk dibandingkan).",
    "git.diff.atCommit": "Diff pada commit {{hash}} — \"{{subject}}\" (bukan working tree sekarang)",
    "git.history.loading": "Memuat riwayat commit…",
    "git.history.empty": "Belum ada commit di repo ini.",
    "git.history.filesLoading": "Memuat daftar file…",
    "git.history.filesEmpty": "Tidak ada file yang berubah di commit ini.",

    // ChatPanel
    "chat.title": "Chat",
    "chat.you": "Kamu",
    "chat.assistant": "Claude Code",
    "chat.showMore": "Tampilkan selengkapnya",
    "chat.showLess": "Tampilkan lebih sedikit",
    "chat.inputPlaceholder": "Ketik pesan lanjutan…",
    "chat.startForm.hint":
      "Mulai sesi Claude Code baru LANGSUNG dari dashboard ini -- beda dari menonton sesi yang " +
      "jalan di VS Code/terminal. Butuh folder project (path lengkap) + instruksi pertama.",
    "chat.startForm.folderLabel": "Folder project",
    "chat.startForm.folderPlaceholder": "C:\\path\\to\\your\\project",
    "chat.startForm.promptLabel": "Instruksi pertama",
    "chat.startForm.promptPlaceholder": "Contoh: perbaiki bug di LoginController.php",
    "chat.startForm.approvalCheckbox": "Mulai di mode Manual (Command Approval)",
    "chat.startForm.warnHint":
      "Sesi chat ini TIDAK PUNYA prompt izin terminal seperti biasa -- kalau kotak ini tidak " +
      "dicentang, semua edit file/command dari sesi ini otomatis DITOLAK sampai kamu pilih mode " +
      "Manual atau Auto sendiri di selector Command Approval (di atas) nanti.",
    "chat.startForm.starting": "Memulai…",
    "chat.startForm.startButton": "Mulai Chat Baru",

    // NotificationBanner
    "notification.defaultMessage": "Claude Code butuh perhatian kamu.",
    "notification.hint": "Respons di terminal/VS Code kamu",

    // PermissionRequestCard
    "permission.titlePrefix": "Claude Code minta izin:",
    "permission.timeoutLabel": "sebelum kembali ke prompt terminal biasa",
    "permission.deny": "Tolak",
    "permission.allow": "Izinkan",
  },

  en: {
    "common.appTitle": "AI Agent Activity Visualizer",
    "common.dash": "—",
    "common.close": "Close",
    "appPreloader.text": "Loading your last session…",
    "statusBar.help.tooltip": "Usage guide",
    "statusBar.help.label": "Help",

    // StatusBar
    "statusBar.connection.idle": "Not connected",
    "statusBar.connection.connecting": "Connecting…",
    "statusBar.connection.open": "Connected",
    "statusBar.connection.closed": "Disconnected — retrying…",
    "statusBar.connection.error": "Connection error",
    "statusBar.exportReport": "Export Report",
    "statusBar.picker.watching": "🔒 Watching",
    "statusBar.picker.changeSession": "Change session",
    "statusBar.picker.stopWatching": "Stop watching",
    "statusBar.picker.switchTo": "Switch to another session:",
    "statusBar.picker.notFound": "session_id not found/no data yet -- try again:",
    "statusBar.picker.noSession": "No session selected yet",
    "statusBar.picker.placeholder": "Paste a Claude Code session_id here…",
    "statusBar.picker.watchButton": "Watch this session",
    "statusBar.picker.cancel": "Cancel",
    "statusBar.picker.watchLatest": "Watch latest session",
    "statusBar.picker.noLatestSession": "No session recorded on the server yet.",

    // RecentSessionsList
    "recentSessions.title": "Sessions on this server",
    "recentSessions.events": "events",
    "recentSessions.empty": "No session_id recorded on this server yet.",
    "recentSessions.clearTooltip": "Clear this session from the server",
    "recentSessions.clearLabel": "Clear this session",
    "recentSessions.confirmDelete": "Clear this session from the server? (the real transcript on disk is untouched)",
    "recentSessions.confirmDeleteCurrent": "Clear this session from the server? You're currently watching it -- clearing it will stop watching automatically.",
    "recentSessions.confirmDeleteYes": "Yes, clear it",
    "recentSessions.confirmDeleteCancel": "Cancel",
    "recentSessions.watchingBadge": "watching",

    // SetupHooksCard
    "setup.hooks.installed": "Claude Code hooks are installed.",
    "setup.hooks.justInstalled": "Hooks installed! Start/continue a Claude Code session for it to take effect.",
    "setup.hooks.missing": "Claude Code hooks: {{done}}/{{total}} installed.",
    "setup.hooks.installButton": "Install Hooks",
    "setup.hooks.installing": "Installing…",
    "statusBar.approval.label": "Command Approval",
    "statusBar.approval.mode.off": "Off",
    "statusBar.approval.mode.manual": "Manual",
    "statusBar.approval.mode.auto": "Auto",
    "statusBar.approval.tooltip.off": "The dashboard doesn't get involved -- Claude Code runs normally.",
    "statusBar.approval.tooltip.offChat": "This chat session has no terminal fallback -- Off means every tool call is auto-denied, not running normally.",
    "statusBar.approval.tooltip.manual":
      "Every file edit & command needs Allow/Deny from the dashboard. 20s max, then falls back to the normal prompt or is auto-denied.",
    "statusBar.approval.tooltip.auto":
      "Everything runs immediately with no approval wait -- still logged in Activity Flow tagged AUTO.",
    "statusBar.approval.confirmAuto.text":
      "Turn on Auto mode? Every file edit & command from Claude Code will run immediately with no approval -- only use this for a session you fully trust.",
    "statusBar.approval.confirmAuto.confirm": "Yes, enable Auto",
    "statusBar.approval.confirmAuto.cancel": "Cancel",
    "statusBar.language.label": "Language",

    // ServerSwitcher -- change which Agent Server to talk to, no Vite restart
    "serverSwitcher.tooltip": "Current Agent Server: {{current}} -- click to change",
    "serverSwitcher.current": "Current server:",
    "serverSwitcher.label": "Switch to a different host/IP",
    "serverSwitcher.placeholder": "e.g. 192.168.1.50 or 192.168.1.50:4000",
    "serverSwitcher.hint": "The page will reload to apply this (not a dev server restart -- that keeps running).",
    "serverSwitcher.apply": "Save & Reload",
    "serverSwitcher.reset": "Reset to default",
    "serverSwitcher.defaultLabel": "default (auto)",
    "serverSwitcher.connected": "Connected to server: {{host}}",
    "serverSwitcher.connectedHint": "If your old session_id shows \"not found\", that's expected -- enter the session_id valid for this server.",
    "serverSwitcher.checking": "Checking...",
    "serverSwitcher.checkFailed": "Could not connect to {{host}}. Make sure the Agent Server is running at that address with the right port (default 4000), then try again.",
    "serverSwitcher.advancedTitle": "Advanced feature",
    "serverSwitcher.advancedHint":
      "Only needed if the Agent Server runs on a different device (e.g. reached over a local network). For a single-machine setup, leave this at its default -- no change needed.",

    // Legend
    "legend.toggle": "Legend",
    "scrollToTop.label": "Scroll to top",
    "legend.colorTitle": "Color meaning",
    "legend.iconTitle": "Icon meaning",
    "legend.color.running": "Running",
    "legend.color.success": "Done / succeeded",
    "legend.color.error": "Error / failed",
    "legend.color.info": "Info / idle",
    "legend.icon.agent": "Agent action (start, thinking, complete)",
    "legend.icon.file": "File (read/edit)",
    "legend.icon.terminal": "Terminal command",
    "legend.icon.chat": "Chat message",

    // OverviewPanel
    "overview.title": "Agent Overview",
    "overview.idle.label": "Idle",
    "overview.idle.sub": "No action currently running",
    "overview.elapsed": "Elapsed",
    "overview.stat.thinking": "Thinking",
    "overview.stat.files": "Files",
    "overview.stat.toolCalls": "Tool Calls",
    "overview.stat.tests": "Tests",
    "overview.stat.tokens": "Tokens",
    "overview.stat.model": "Model",
    "overview.tokenUsage.title": "Token Usage (last 5 hours)",
    "overview.tokenUsage.messages": "{{count}} assistant messages",
    "overview.tokenUsage.caption":
      "From this session only (the session_id currently being watched) — not your account's total quota. " +
      "If another Claude Code session is running at the same time, it isn't counted here.",
    "overview.tokenUsage.empty": "No activity in the last 5 hours yet.",
    "overview.waiting": "Waiting for transcript data…",
    "overview.summary.title": "Session Summary",
    "overview.summary.badge": "COMPLETE",
    "overview.summary.duration": "Total Duration",
    "overview.summary.toolCalls": "Tool Calls",
    "overview.summary.filesChanged": "Files Changed",
    "overview.summary.tokensUsed": "Tokens Used",
    "overview.summary.outcome": "Outcome",
    "overview.summary.success": "Success",
    "overview.summary.finishedAt": "Finished at {{time}}",

    "activity.editing": "Editing File",
    "activity.terminal": "Running Command",
    "activity.thinking": "Thinking",

    // ActivityFlowPanel
    "activityFlow.title": "Activity Flow",
    "activityFlow.live": "Live",
    "activityFlow.searchPlaceholder": "Search activity…",
    "activityFlow.filter.all": "All",
    "activityFlow.filter.thinking": "Thinking",
    "activityFlow.filter.run": "Run",
    "activityFlow.filter.complete": "Complete",
    "activityFlow.filter.error": "Error",
    "activityFlow.list.empty": "No matching activity.",
    "activityFlow.current": "current",
    "activityFlow.selected": "selected",
    "activityFlow.stillWorking": "still working…",
    "activityFlow.emptyGraphPrefix": "Enter a",
    "activityFlow.emptyGraphSuffix": "in the box above to start watching — the dashboard never guesses a session on its own.",
    "activityFlow.emptyLoading": "Checking session…",
    "activityFlow.emptyInvalidPrefix": "No data yet for session_id",
    "activityFlow.emptyInvalidSuffix":
      "— double-check the session_id, or wait for Claude Code (with hooks installed) to send its first event.",

    "event.agentStart": "Agent Start",
    "event.thinking": "Thinking…",
    "event.complete": "Complete",
    "event.error": "Error",
    "event.notification": "Notification",
    "event.userMessage": "Your Message",
    "event.assistantReply": "Claude's Reply",
    "event.read": "Read",
    "event.editing": "Editing…",
    "event.edited": "Edited",
    "event.run": "Run",
    "event.output": "Output",
    "event.terminalDone": "Terminal Done",
    "event.autoApproved": "Auto-approved",
    "event.autoBadge": "AUTO",
    "event.decidedAllow": "Allowed (Manual)",
    "event.decidedDeny": "Denied (Manual)",

    // DetailsPanel
    "details.title": "Details",
    "details.empty": "Click an event in Activity Flow to see its details.",
    "details.field.file": "File",
    "details.field.command": "Command",
    "details.field.category": "Category",
    "details.field.reason": "Reason",
    "details.field.message": "Message",
    "details.field.status": "Status",
    "details.field.duration": "Duration",
    "details.field.lines": "Lines",
    "details.field.changes": "Changes",
    "details.agentThoughts": "Agent Thoughts",
    "details.diffPreview": "Diff Preview",
    "details.output": "Output",
    "details.openInVSCode": "Open in VS Code",
    "details.openInVSCodeTitle": "Open this file in VS Code (requires VS Code installed & registered as the vscode:// handler)",

    // TerminalLogPanel
    "terminal.title": "Terminal / Log Output",
    "terminal.debugMode": "Debug mode",
    "terminal.debugTooltip": "ON: show the raw JSON event as-is (for debugging). OFF: a short summary only.",
    "terminal.empty": "No terminal output in this session yet.",
    "terminal.concise.tool": "Tool",
    "terminal.concise.command": "Command",
    "terminal.concise.file": "File",
    "terminal.concise.status": "Status",
    "terminal.concise.statusError": "Error",
    "terminal.concise.statusSuccess": "Done",
    "terminal.concise.statusRunning": "Running",

    // InsightsPanel -- used to be an empty slot (PlaceholderPanel), now 4
    // small tabs (Files/Cost/Alerts/Tests), all purely derived from the
    // events/usage already in the store.
    "insights.title": "Insights",
    "insights.noSession": "No session watched yet.",
    "insights.tab.files": "Files",
    "insights.tab.cost": "Cost",
    "insights.tab.alerts": "Alerts",
    "insights.tab.tests": "Tests",
    "insights.files.empty": "No files edited in this session yet.",
    "insights.files.editsCount": "{{count}}x edit",
    "insights.cost.empty": "No token usage data yet.",
    "insights.cost.disclaimer": "Estimated from public list pricing, not your actual account bill.",
    "insights.cost.input": "Input",
    "insights.cost.output": "Output",
    "insights.cost.cacheWrite": "Cache write",
    "insights.cost.cacheRead": "Cache read",
    "insights.alerts.empty": "No notifications or permission decisions in this session yet.",
    "insights.tests.empty": "No test summary detected from terminal output.",
    "insights.tests.passed": "{{count}} passed",
    "insights.tests.failed": "{{count}} failed",
    "insights.tests.caption": "Detected from {{source}} output format (best-effort, may misread).",

    // GitPanel
    "git.title": "Git",
    "git.tab.status": "Status",
    "git.tab.diff": "Diff",
    "git.tab.history": "History",
    "git.noRoot": "No active file/session yet to determine the project from.",
    "git.status.loading": "Loading git status…",
    "git.status.notRepo": "This folder isn't part of a git repo.",
    "git.status.clean": "No changes -- working tree is clean.",
    "git.status.caption": "Not yet committed. M = content changed, D = file deleted.",
    "git.status.staged": "Staged",
    "git.status.modified": "Modified",
    "git.status.untracked": "Untracked",
    "git.diff.selectHint": "Click a file in the Status tab to see its diff.",
    "git.diff.loading": "Loading diff…",
    "git.diff.none": "No diff for {{file}} (new/untracked files have no baseline to compare against).",
    "git.diff.atCommit": "Diff at commit {{hash}} — \"{{subject}}\" (not the current working tree)",
    "git.history.loading": "Loading commit history…",
    "git.history.empty": "No commits in this repo yet.",
    "git.history.filesLoading": "Loading file list…",
    "git.history.filesEmpty": "No files changed in this commit.",

    // ChatPanel
    "chat.title": "Chat",
    "chat.you": "You",
    "chat.assistant": "Claude Code",
    "chat.showMore": "Show more",
    "chat.showLess": "Show less",
    "chat.inputPlaceholder": "Type a follow-up message…",
    "chat.startForm.hint":
      "Start a new Claude Code session DIRECTLY from this dashboard -- different from watching a " +
      "session running in VS Code/terminal. Needs a project folder (full path) + a first instruction.",
    "chat.startForm.folderLabel": "Project folder",
    "chat.startForm.folderPlaceholder": "C:\\path\\to\\your\\project",
    "chat.startForm.promptLabel": "First instruction",
    "chat.startForm.promptPlaceholder": "Example: fix the bug in LoginController.php",
    "chat.startForm.approvalCheckbox": "Start in Manual mode (Command Approval)",
    "chat.startForm.warnHint":
      "This chat session does NOT have a normal terminal permission prompt -- if this box isn't " +
      "checked, every file edit/command from this session is automatically DENIED until you pick " +
      "Manual or Auto yourself in the Command Approval selector (above) later.",
    "chat.startForm.starting": "Starting…",
    "chat.startForm.startButton": "Start New Chat",

    // NotificationBanner
    "notification.defaultMessage": "Claude Code needs your attention.",
    "notification.hint": "Respond in your terminal/VS Code",

    // PermissionRequestCard
    "permission.titlePrefix": "Claude Code requests permission:",
    "permission.timeoutLabel": "before falling back to the normal terminal prompt",
    "permission.deny": "Deny",
    "permission.allow": "Allow",
  },
};
