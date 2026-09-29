/**
 * Frank's Market — Google Apps Script backend
 * Sheet "Products": id | name | emoji | price | stock
 * Sheet "Orders"  : timestamp | order_id | name | note | items | total
 * Jalankan fungsi setup() satu kali untuk membuat sheet + data awal.
 */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let p = ss.getSheetByName("Products") || ss.insertSheet("Products");
  if (p.getLastRow() === 0) {
    p.appendRow(["id", "name", "emoji", "price", "stock"]);
    [
      ["P1", "Frank's Burger", "🍔", 49000, 20],
      ["P2", "Crispy Fries", "🍟", 25000, 35],
      ["P3", "Milkshake", "🥤", 32000, 15],
      ["P4", "Chicken Tenders", "🍗", 39000, 12],
      ["P5", "Frank's Cap", "🧢", 89000, 8],
      ["P6", "Kitchen Backpack", "🎒", 249000, 5],
    ].forEach((r) => p.appendRow(r));
    p.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#ffd84a");
    p.setFrozenRows(1);
  }
  let o = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
  if (o.getLastRow() === 0) {
    o.appendRow(["timestamp", "order_id", "name", "note", "items", "total"]);
    o.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f5170f").setFontColor("#fff");
    o.setFrozenRows(1);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getProducts_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("products");
  if (hit) return JSON.parse(hit); // cepat, tanpa membaca spreadsheet

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Products");
  const rows = sh.getDataRange().getValues();
  rows.shift();
  const list = rows
    .filter((r) => r[0] !== "")
    .map((r) => ({ id: String(r[0]), name: r[1], emoji: r[2], price: Number(r[3]), stock: Number(r[4]) }));
  cache.put("products", JSON.stringify(list), 60); // simpan 60 detik
  return list;
}

function doGet() {
  return json_({ ok: true, products: getProducts_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // cegah stok bentrok saat banyak pembeli
    const data = JSON.parse(e.postData.contents);
    if (data.action !== "order") return json_({ ok: false, error: "Aksi tidak dikenal" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Products");
    const rows = sh.getDataRange().getValues();
    let total = 0;
    const lines = [];

    // validasi semua item dulu
    for (const it of data.items) {
      const idx = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(it.id));
      if (idx < 0) return json_({ ok: false, error: "Produk tidak ditemukan" });
      if (Number(rows[idx][4]) < it.qty) return json_({ ok: false, error: "Stok " + rows[idx][1] + " tidak cukup" });
    }
    // kurangi stok
    for (const it of data.items) {
      const idx = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(it.id));
      const newStock = Number(rows[idx][4]) - it.qty;
      sh.getRange(idx + 1, 5).setValue(newStock);
      rows[idx][4] = newStock;
      total += Number(rows[idx][3]) * it.qty;
      lines.push(rows[idx][1] + " x" + it.qty);
    }
    CacheService.getScriptCache().remove("products"); // stok berubah, cache dibuang
    const orderId = "ORD-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyMMddHHmmss");
    ss.getSheetByName("Orders").appendRow([new Date(), orderId, data.name, data.note || "", lines.join(", "), total]);
    return json_({ ok: true, orderId: orderId, products: getProducts_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
