/* ============ KONFIGURASI ============
   Isi dengan URL Web App dari Apps Script (berakhiran /exec) */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz6ZhYqs0x59IpaDgej8Dj6346BKI2Dn3LzZS4WzRmllDmzwNBRKVq1FR4jRMIFlEFxig/exec";
/* ===================================== */

const $ = (s) => document.querySelector(s);
const rupiah = (n) => "Rp" + Number(n).toLocaleString("id-ID");
let products = [], cart = {}, cur = 0;

// data contoh dipakai jika WEB_APP_URL masih kosong
const DEMO = [
  { id: "P1", name: "Frank's Burger", emoji: "🍔", price: 49000, stock: 20 },
  { id: "P2", name: "Crispy Fries", emoji: "🍟", price: 25000, stock: 35 },
  { id: "P3", name: "Milkshake", emoji: "🥤", price: 32000, stock: 15 },
  { id: "P4", name: "Chicken Tenders", emoji: "🍗", price: 39000, stock: 12 },
  { id: "P5", name: "Frank's Cap", emoji: "🧢", price: 89000, stock: 8 },
  { id: "P6", name: "Kitchen Backpack", emoji: "🎒", price: 249000, stock: 5 },
];

/* ---------- toast & tema ---------- */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2800);
}
const root = document.documentElement;
const saved = localStorage.getItem("theme");
if (saved) root.dataset.theme = saved;
const syncIcon = () => ($("#themeBtn").textContent = root.dataset.theme === "dark" ? "☀️" : "🌙");
syncIcon();
$("#themeBtn").onclick = () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", root.dataset.theme);
  syncIcon();
};

/* ---------- scroll reveal ---------- */
const io = new IntersectionObserver(
  (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
  { threshold: 0.15 }
);
const observe = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));

/* ---------- data ---------- */
const CACHE_KEY = "frank_products";
function saveCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(products)); } catch (e) {} }

async function loadProducts() {
  if (!WEB_APP_URL) { products = JSON.parse(JSON.stringify(DEMO)); toast("Mode demo: isi WEB_APP_URL di App.js"); return render(); }
  // 1) tampilkan data cache seketika (tanpa menunggu spreadsheet)
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && c.length) { products = c; render(); }
  } catch (e) {}
  // 2) segarkan data terbaru di belakang layar
  try {
    const r = await fetch(WEB_APP_URL + "?action=products");
    products = (await r.json()).products;
    saveCache();
    render();
  } catch (e) {
    if (!products.length) { products = JSON.parse(JSON.stringify(DEMO)); render(); }
    toast("Gagal memuat spreadsheet");
  }
}

function badge(p) {
  if (p.stock <= 0) return `<span class="stock out">Habis</span>`;
  if (p.stock <= 5) return `<span class="stock low">Sisa ${p.stock}</span>`;
  return `<span class="stock">Stok ${p.stock}</span>`;
}

function render() {
  $("#products").innerHTML = products.map((p, i) => `
    <div class="card reveal" style="--d:${(i % 4) * 0.08}s">
      <div class="em">${p.emoji}</div><h3>${p.name}</h3>
      <div class="pr">${rupiah(p.price)}</div>${badge(p)}<br>
      <button class="btn" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>Tambah</button>
    </div>`).join("");
  $("#mq").innerHTML = Array(2).fill(products.map((p) => `<span>${p.name}</span><b>✦</b>`).join("") + "<span>Explore Shop</span><b>✦</b>").join("");
  showFeatured();
  renderCart();
  observe();
}

function showFeatured() {
  if (!products.length) return;
  const p = products[cur];
  const b = $("#blob");
  b.innerHTML = `<div class="swap"><small class="bebas">smashed</small><span class="em">${p.emoji}</span><div class="nm bebas">${p.name}</div><div class="pr bebas">${rupiah(p.price)}</div>${badge(p)}<br><button class="btn" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""} style="font-size:1.1rem;padding:8px 22px;margin-top:6px">Tambah</button></div>`;
}
$("#prev").onclick = () => { cur = (cur - 1 + products.length) % products.length; showFeatured(); };
$("#next").onclick = () => { cur = (cur + 1) % products.length; showFeatured(); };

/* ---------- keranjang ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-add]");
  if (a) change(a.dataset.add, 1);
  const m = e.target.closest("[data-chg]");
  if (m) change(m.dataset.id, +m.dataset.chg);
});

function change(id, d) {
  const p = products.find((x) => x.id === id);
  const q = (cart[id] || 0) + d;
  if (q > p.stock) return toast("Stok " + p.name + " tidak cukup");
  if (q <= 0) delete cart[id]; else cart[id] = q;
  renderCart();
  if (d > 0) toast(p.name + " ditambahkan");
}

function renderCart() {
  const ids = Object.keys(cart);
  let total = 0, count = 0;
  $("#items").innerHTML = ids.length
    ? ids.map((id) => {
        const p = products.find((x) => x.id === id);
        if (!p) return "";
        total += p.price * cart[id]; count += cart[id];
        return `<div class="row"><span>${p.emoji} ${p.name}</span><span><button data-id="${id}" data-chg="-1">−</button>${cart[id]}<button data-id="${id}" data-chg="1">+</button></span></div>`;
      }).join("")
    : "<p style='opacity:.6'>Keranjang masih kosong.</p>";
  $("#total").textContent = rupiah(total);
  $("#cartCount").textContent = count;
}

const drawer = (open) => { $("#drawer").classList.toggle("open", open); $("#veil").classList.toggle("open", open); };
$("#cartBtn").onclick = () => drawer(true);
$("#veil").onclick = () => drawer(false);

/* ---------- checkout ---------- */
$("#checkout").onclick = async () => {
  const name = $("#cName").value.trim();
  const items = Object.keys(cart).map((id) => ({ id, qty: cart[id] }));
  if (!items.length) return toast("Keranjang masih kosong");
  if (!name) return toast("Isi nama pembeli dulu");
  const btn = $("#checkout");
  btn.disabled = true; btn.textContent = "Memproses...";
  try {
    if (!WEB_APP_URL) {
      items.forEach((i) => (products.find((p) => p.id === i.id).stock -= i.qty)); // simulasi lokal
    } else {
      const r = await fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({ action: "order", name, note: $("#cClass").value.trim(), items }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Gagal");
      products = d.products;
      saveCache();
    }
    cart = {};
    render();
    drawer(false);
    toast("Pesanan berhasil! Terima kasih, " + name);
  } catch (err) {
    toast("Error: " + err.message);
  }
  btn.disabled = false; btn.textContent = "Checkout";
};

observe();
loadProducts();
