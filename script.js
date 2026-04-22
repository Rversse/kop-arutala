const API_URL        = "https://script.google.com/macros/s/AKfycbzky4j7P0KQ3-knTcWSxH8yJPVKUpnGHNs3zX7P0kkl67_oaC2SENB1rJ3urR09hfIr/exec";
const AUTO_REFRESH_S = 30 * 60;
const NAIK_THRESHOLD = 10;

let allData    = [];
let categories = [];
const katOpen  = {};
let countdown  = AUTO_REFRESH_S;
let countdownTimer;

// ── INIT PAGE ───────────────────────────────────────────────
document.getElementById("tanggal-hari-ini").textContent =
  new Date().toLocaleDateString("id-ID", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });

const scrollBtn = document.getElementById("scroll-top");
window.addEventListener("scroll", () => {
  scrollBtn.classList.toggle("visible", window.scrollY > 300);
});

// ── FETCH DATA ───────────────────────────────────────────────
async function init() {
  try {
    const res  = await fetch(API_URL);
    const json = await res.json();
    if (json.status !== "ok") throw new Error(json.message || "Error dari server");

    allData    = json.data;
    categories = [...new Set(allData.map(d => d.kategori))].sort();
    categories.forEach(k => { if (katOpen[k] === undefined) katOpen[k] = false; });

    const updated = new Date(json.updated);
    document.getElementById("last-updated").textContent =
      "Data: " + updated.toLocaleString("id-ID", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });

    updateStats(allData);
    renderAccordion(allData);
    startCountdown();

  } catch (err) {
    document.getElementById("table-area").innerHTML =
      '<div class="state-box"><div class="icon">⚠️</div><p>Gagal memuat data. Periksa koneksi atau URL API.<br><small>' + err.message + '</small></p></div>';
    document.getElementById("last-updated").textContent = "Gagal memuat";
  }
}

// ── REFRESH ─────────────────────────────────────────────────
function refreshData() {
  clearInterval(countdownTimer);
  countdown = AUTO_REFRESH_S;
  document.getElementById("table-area").innerHTML =
    '<div class="state-box"><div class="spinner"></div><p>Memperbarui data…</p></div>';
  init();
}

// ── AUTO-REFRESH COUNTDOWN ───────────────────────────────────
function startCountdown() {
  clearInterval(countdownTimer);
  countdown = AUTO_REFRESH_S;
  updateCountdownDisplay();
  countdownTimer = setInterval(() => {
    countdown--;
    updateCountdownDisplay();
    if (countdown <= 0) { clearInterval(countdownTimer); init(); }
  }, 1000);
}

function updateCountdownDisplay() {
  const m = String(Math.floor(countdown / 60)).padStart(2, "0");
  const s = String(countdown % 60).padStart(2, "0");
  document.getElementById("refresh-countdown").textContent = "auto-refresh " + m + ":" + s;
}

// ── FILTER ───────────────────────────────────────────────────
function getFiltered() {
  const keyword   = document.getElementById("search").value.toLowerCase().trim();
  const onlyAvail = document.getElementById("toggle-tersedia").checked;
  return allData.filter(item => {
    const matchAvail = !onlyAvail || String(item.tersedia).toLowerCase() !== "tidak";
    const matchKw    = !keyword || item.nama.toLowerCase().includes(keyword);
    return matchAvail && matchKw;
  });
}

function applyFilters() {
  const filtered = getFiltered();
  updateStats(filtered);
  renderAccordion(filtered);
}

// ── STATS ────────────────────────────────────────────────────
function updateStats(data) {
  document.getElementById("stat-total").textContent    = data.length;
  document.getElementById("stat-naik").textContent     = data.filter(d => getStatus(d) === "naik").length;
  document.getElementById("stat-turun").textContent    = data.filter(d => getStatus(d) === "turun").length;
  document.getElementById("stat-notavail").textContent = allData.filter(d => String(d.tersedia).toLowerCase() === "tidak").length;
}

// ── EXPAND / COLLAPSE ────────────────────────────────────────
function expandAll() {
  categories.forEach(k => katOpen[k] = true);
  document.querySelectorAll(".kat-block").forEach(b => b.classList.add("open"));
}

function collapseAll() {
  categories.forEach(k => katOpen[k] = false);
  document.querySelectorAll(".kat-block").forEach(b => b.classList.remove("open"));
}

// ── RENDER ACCORDION ─────────────────────────────────────────
function renderAccordion(data) {
  const area = document.getElementById("table-area");

  if (!data.length) {
    area.innerHTML = '<div class="state-box"><div class="icon">🔍</div><p>Tidak ada item yang cocok.</p></div>';
    return;
  }

  const grouped = {};
  data.forEach(item => {
    if (!grouped[item.kategori]) grouped[item.kategori] = [];
    grouped[item.kategori].push(item);
  });

  area.innerHTML = "";

  Object.keys(grouped).sort().forEach(kat => {
    const items  = grouped[kat];
    const isOpen = katOpen[kat] !== false;

    const block       = document.createElement("div");
    block.className   = "kat-block" + (isOpen ? " open" : "");
    block.dataset.kat = kat;

    // Baris data atau pesan kosong
    let tbodyContent;
    if (items.length === 0) {
      tbodyContent = '<tr><td colspan="6"><div class="empty-kat">Tidak ada item di kategori ini.</div></td></tr>';
    } else {
      tbodyContent = items.map(item => {
        const st    = getStatus(item);
        const pct   = item.hargaKemarin > 0 ? ((item.hargaAktif - item.hargaKemarin) / item.hargaKemarin * 100) : 0;
        const isHot = st === "naik" && pct >= NAIK_THRESHOLD;
        const rc    = isHot ? ' class="naik-signifikan"' : '';
        return '<tr' + rc + '>' +
          '<td class="nama-col">' + namaHtml(item) + '</td>' +
          '<td>' + escHtml(item.satuan) + '</td>' +
          '<td class="harga hide-mobile">' + fmtRp(item.hargaKemarin) + '</td>' +
          '<td class="harga harga-aktif">' + fmtRp(item.hargaAktif) + '</td>' +
          '<td>' + badgeHtml(st, item, isHot) + '</td>' +
          '<td class="hide-mobile">' + tersediaHtml(item.tersedia) + '</td>' +
          '</tr>';
      }).join("");
    }

    block.innerHTML =
      '<button class="kat-toggle">' +
        '<div class="kat-meta">' +
          '<span>📂 ' + escHtml(kat) + '</span>' +
          '<span class="kat-count">' + items.length + ' item</span>' +
        '</div>' +
        '<span class="kat-arrow">▼</span>' +
      '</button>' +
      '<div class="kat-body">' +
        '<table><thead><tr>' +
          '<th class="th-nama">Nama Barang</th>' +
          '<th>Satuan</th>' +
          '<th class="hide-mobile">Harga Lama</th>' +
          '<th>Harga</th>' +
          '<th>Status</th>' +
          '<th class="hide-mobile">Tersedia</th>' +
        '</tr></thead>' +
        '<tbody>' + tbodyContent + '</tbody>' +
      '</table></div>';

    block.querySelector(".kat-toggle").addEventListener("click", () => {
      const open = block.classList.toggle("open");
      katOpen[kat] = open;
    });

    area.appendChild(block);
  });
}

// ── HELPERS ──────────────────────────────────────────────────

// Nama item + tooltip keterangan (kalau ada)
function namaHtml(item) {
  const ket = item.keterangan ? String(item.keterangan).trim() : "";
  if (!ket) return escHtml(item.nama);
  return '<span class="nama-wrap">' +
    escHtml(item.nama) +
    '<span class="ket-icon">ℹ</span>' +
    '<span class="tooltip">' + escHtml(ket) + '</span>' +
  '</span>';
}

function getStatus(item) {
  if (!item.hargaKemarin || !item.hargaAktif) return "baru";
  if (item.hargaAktif > item.hargaKemarin)    return "naik";
  if (item.hargaAktif < item.hargaKemarin)    return "turun";
  return "sama";
}

function badgeHtml(st, item, isHot) {
  const selisih = item.hargaAktif - item.hargaKemarin;
  if (st === "naik") {
    const cls   = isHot ? "badge-naik-panas" : "badge-naik";
    const label = isHot ? ("🔥 +" + fmtRp(selisih)) : ("▲ +" + fmtRp(selisih));
    return '<span class="badge ' + cls + '">' + label + '</span>';
  }
  if (st === "turun") return '<span class="badge badge-turun">▼ ' + fmtRp(selisih) + '</span>';
  if (st === "baru")  return '<span class="badge badge-sama">✦ Baru</span>';
  return '<span class="badge badge-sama">— Sama</span>';
}

function tersediaHtml(val) {
  return String(val).toLowerCase() === "tidak"
    ? '<span class="tersedia-no">✗ Tidak</span>'
    : '<span class="tersedia-yes">✓ Ya</span>';
}

function fmtRp(val) {
  if (!val || val === 0) return "—";
  return "Rp " + Number(val).toLocaleString("id-ID");
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── EVENT LISTENERS ──────────────────────────────────────────
document.getElementById("search").addEventListener("input", applyFilters);
document.getElementById("toggle-tersedia").addEventListener("change", applyFilters);

// ── START ────────────────────────────────────────────────────
init();
