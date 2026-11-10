"use strict";

const MOVIES = [
  { id: 1, title: "He's Dating a Boldstar", poster: "images/malupiton.jpg", price: 280, genre: "Romcom", mins: 112, times: ["10:00 AM", "1:30 PM", "7:00 PM"] },
  { id: 2, title: "Spiderman Brand New Day", poster: "images/spiderman.jpg", price: 280, genre: "Sci-Fi", mins: 124, times: ["11:00 AM", "2:30 PM", "8:00 PM"] },
  { id: 3, title: "Avengers Doomsday", poster: "images/avengers.jpg", price: 350, genre: "Drama", mins: 105, times: ["12:00 PM", "4:00 PM", "9:00 PM"] }
];
const ROWS = "ABCDEFGH".split("");
const COLS = 10;
const MAX_SEATS = 80;
const KEY = "cineseat_reservations";
const CASHIER_KEY = "cineseat_cashier";
const NAME_RULE = [v => /^[A-Za-z][A-Za-z .'-]{1,49}$/.test(v), "Enter a valid name (letters only, at least 2 characters)."];
const RULES = {
  fName: NAME_RULE,
  fContact: [v => /^09\d{9}$/.test(v), "Enter an 11-digit number starting with 09."]
};

let selected = [];
let reservations = [];
let cashier = null;

const $ = id => document.getElementById(id);
const money = n => "PHP " + n.toLocaleString("en-US");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const currentMovie = () => MOVIES.find(m => m.id === Number($("movie").value));
const ticketPrice = () => currentMovie().price;
const slotKey = () => [$("movie").value, $("date").value, $("showtime").value].join("|");

/* ---------- storage ---------- */
function loadData() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    reservations = Array.isArray(data) ? data : [];
  } catch (e) {
    reservations = [];
  }
}
function saveData() {
  try {
    localStorage.setItem(KEY, JSON.stringify(reservations));
  } catch (e) {
    showMessage("Could not save data in this browser.", "err");
  }
}

/* ---------- start ---------- */
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  loadData();
  loadCashier();
  $("movie").innerHTML = MOVIES.map(m => `<option value="${m.id}">${esc(m.title)}</option>`).join("");
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $("date").value = today;
  $("date").min = today;
  selectMovie();

  $("movie").addEventListener("change", selectMovie);
  $("date").addEventListener("change", renderSeatMap);
  $("showtime").addEventListener("change", renderSeatMap);
  $("seatMap").addEventListener("click", e => {
    const btn = e.target.closest(".seat");
    if (btn && !btn.disabled) toggleSeat(btn);
  });
  $("clearBtn").addEventListener("click", clearSelection);
  $("bookForm").addEventListener("input", e => { if (RULES[e.target.id]) validateField(e.target); });
  $("bookForm").addEventListener("submit", e => { e.preventDefault(); if (validateForm()) confirmBooking(); });
  document.querySelectorAll("nav button").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
  $("search").addEventListener("input", renderReservations);
  $("statusFilter").addEventListener("change", renderReservations);
  $("resBody").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.act === "cancel") cancelReservation(b.dataset.ref);
    if (b.dataset.act === "receipt") showReceipt(b.dataset.ref);
  });
  $("printBtn").addEventListener("click", () => window.print());
  $("toResBtn").addEventListener("click", () => { closeModal(); showView("resView"); });
  $("newBtn").addEventListener("click", () => { closeModal(); showView("bookView"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  $("loginForm").addEventListener("submit", signIn);
  $("signOutBtn").addEventListener("click", signOut);
  $("payMethod").addEventListener("change", togglePayment);
  $("fPaid").addEventListener("input", updateChange);
  togglePayment();
  renderReservations();
}

/* ---------- booking ---------- */
function selectMovie() {
  const mv = currentMovie();
  $("poster").src = mv.poster;
  $("poster").alt = "Poster of " + mv.title;
  $("mTitle").textContent = mv.title;
  $("mInfo").textContent = mv.genre + " | " + mv.mins + " min | " + money(mv.price) + " per seat";
  $("showtime").innerHTML = currentMovie().times.map(t => `<option>${t}</option>`).join("");
  renderSeatMap();
}

function renderSeatMap() {
  selected = [];
  const taken = reservations
    .filter(r => r.status === "Active" && r.key === slotKey())
    .flatMap(r => r.seats);
  let html = "";
  ROWS.forEach(row => {
    html += `<div class="row"><b>${row}</b>`;
    for (let n = 1; n <= COLS; n++) {
      const id = row + n;
      const isTaken = taken.includes(id);
      const cls = "seat" + (isTaken ? " taken" : "");
      html += `<button type="button" class="${cls}" data-seat="${id}" ${isTaken ? "disabled" : ""} aria-label="Seat ${id}">${n}</button>`;
    }
    html += "</div>";
  });
  $("seatMap").innerHTML = html;
  updateSummary();
}

function toggleSeat(btn) {
  const id = btn.dataset.seat;
  const i = selected.indexOf(id);
  if (i > -1) {
    selected.splice(i, 1);
    btn.classList.remove("selected");
    showMessage("", "");
  } else {
    if (selected.length >= MAX_SEATS) {
      showMessage("Maximum of " + MAX_SEATS + " seats per booking.", "err");
      return;
    }
    selected.push(id);
    btn.classList.add("selected");
    showMessage("", "");
  }
  updateSummary();
}

function clearSelection() {
  selected = [];
  document.querySelectorAll(".seat.selected").forEach(b => b.classList.remove("selected"));
  showMessage("", "");
  updateSummary();
}

function updateSummary() {
  $("sMovie").textContent = currentMovie().title;
  $("sWhen").textContent = ($("date").value || "-") + " " + $("showtime").value;
  $("sPrice").textContent = money(ticketPrice());
  $("sSeats").textContent = selected.length ? [...selected].sort().join(", ") : "-";
  $("sTotal").textContent = money(selected.length * ticketPrice());
  updateChange();
}

function showMessage(text, type) {
  const m = $("msg");
  m.textContent = text;
  m.className = "hint " + type;
}

/* ---------- validation ---------- */
function validateField(el) {
  const [test, message] = RULES[el.id];
  if (!el.value.trim()) {              /* optional fields: empty is fine */
    el.classList.remove("good", "bad");
    $("e_" + el.id).textContent = "";
    return true;
  }
  const good = test(el.value.trim());
  el.classList.toggle("bad", !good);
  el.classList.toggle("good", good);
  const hint = $("e_" + el.id);
  hint.textContent = good ? "Looks good." : message;
  hint.className = "hint " + (good ? "ok" : "err");
  return good;
}

function validateForm() {
  const fieldsOk = Object.keys(RULES).map(id => validateField($(id))).every(Boolean);
  if (!$("date").value || $("date").value < $("date").min) {
    showMessage("Please choose today or a future date.", "err");
    return false;
  }
  if (selected.length === 0) {
    showMessage("Please select at least one seat.", "err");
    return false;
  }
  if (!fieldsOk) {
    showMessage("Please fix the highlighted fields.", "err");
    return false;
  }
  if ($("payMethod").value === "Cash") {
    const paid = Number($("fPaid").value);
    if (!paid || paid < selected.length * ticketPrice()) {
      showMessage("Amount received must be at least the total.", "err");
      return false;
    }
  }
  return true;
}

function confirmBooking() {
  const seats = [...selected].sort();
  const next = reservations.reduce((m, r) => Math.max(m, parseInt(r.ref.slice(3), 10)), 0) + 1;
  const total = seats.length * ticketPrice();
  const method = $("payMethod").value;
  const paid = method === "Cash" ? Number($("fPaid").value) : total;
  const r = {
    ref: "CS-" + String(next).padStart(4, "0"),
    key: slotKey(),
    movie: currentMovie().title,
    date: $("date").value,
    showtime: $("showtime").value,
    name: $("fName").value.trim() || "Walk-in",
    contact: $("fContact").value.trim(),
    seats: seats,
    price: ticketPrice(),
    total: total,
    method: method,
    paid: paid,
    change: paid - total,
    cashier: cashier.name,
    counter: cashier.counter,
    status: "Active",
    soldOn: todayISO(),
    booked: new Date().toLocaleString()
  };
  reservations.push(r);
  saveData();
  $("bookForm").reset();
  ["fName", "fContact"].forEach(id => {
    $(id).classList.remove("good", "bad");
    $("e_" + id).textContent = "";
  });
  togglePayment();
  renderSeatMap();
  renderReservations();
  showReceipt(r.ref);
}

/* ---------- receipt ---------- */
function barcode(text) {
  return [...(text + "|" + text)].map(c => `<i style="width:${1 + (c.charCodeAt(0) % 4)}px"></i>`).join("");
}

function showReceipt(ref) {
  const r = reservations.find(x => x.ref === ref);
  if (!r) return;
  const unit = r.price || r.total / r.seats.length;
  const method = r.method || "Cash";
  const pay = method === "Cash" && r.paid != null
    ? `<div class="ln"><span>Cash received</span><span>${money(r.paid)}</span></div>
       <div class="ln"><span>Change</span><span>${money(r.change)}</span></div>` : "";
  $("receipt").innerHTML = `
    <img class="rlogo" src="images/logo-bw.svg" alt="">
    <h2>ROBINSON CINEMA</h2>
    <p class="c">Ticket Receipt</p>
    <hr>
    <div class="big">${esc(r.ref)}</div>
    <p class="c small">Issued: ${esc(r.booked)}</p>
    <p class="c small">Cashier: ${esc(r.cashier || "-")} (${esc(r.counter || "-")})</p>
    <hr>
    <div class="ln"><span>Customer</span><span>${esc(r.name)}</span></div>
    ${r.contact ? `<div class="ln"><span>Contact</span><span>${esc(r.contact)}</span></div>` : ""}
    <div class="ln"><span>Movie</span><span>${esc(r.movie)}</span></div>
    <div class="ln"><span>Date</span><span>${esc(r.date)}</span></div>
    <div class="ln"><span>Showtime</span><span>${esc(r.showtime)}</span></div>
    <div class="ln"><span>Seats</span><span>${esc(r.seats.join(", "))}</span></div>
    <hr>
    <div class="ln"><span>Ticket x${r.seats.length} @ ${money(unit)}</span><span>${money(r.total)}</span></div>
    <hr>
    <div class="ln tot"><span>TOTAL</span><span>${money(r.total)}</span></div>
    <div class="ln"><span>Payment</span><span>${esc(method)}</span></div>
    ${pay}
    <p class="c">Status: <b>${esc(statusLabel(r.status).toUpperCase())}</b></p>
    <div class="bars">${barcode(r.ref)}</div>
    <p class="c small">Present this receipt at the entrance.<br>Please arrive 15 minutes before showtime.<br>Thank you!</p>`;
  $("modal").hidden = false;
}

function closeModal() {
  $("modal").hidden = true;
}

/* ---------- reservations ---------- */
function renderReservations() {
  renderTodaySummary();
  const q = $("search").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const rows = reservations.filter(r =>
    (status === "All" || r.status === status) &&
    (r.name.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q)));
  $("resBody").innerHTML = rows.length
    ? rows.map(r => `<tr>
        <td>${esc(r.ref)}</td><td>${esc(r.name)}</td><td>${esc(r.movie)}</td>
        <td>${esc(r.date)} ${esc(r.showtime)}</td><td>${esc(r.seats.join(", "))}</td>
        <td>${money(r.total)}</td><td>${esc(r.method || "Cash")}</td><td>${esc(r.cashier || "-")}</td>
        <td class="${r.status === "Cancelled" ? "cancelled" : ""}">${statusLabel(r.status)}</td>
        <td><button data-act="receipt" data-ref="${esc(r.ref)}">Receipt</button>
        ${r.status === "Active" ? `<button class="danger" data-act="cancel" data-ref="${esc(r.ref)}">Void</button>` : ""}</td>
      </tr>`).join("")
    : `<tr><td colspan="10">No transactions found.</td></tr>`;
}

function renderTodaySummary() {
  const t = reservations.filter(r => r.status === "Active" && r.soldOn === todayISO());
  $("stSales").textContent = money(t.reduce((s, r) => s + r.total, 0));
  $("stTickets").textContent = t.reduce((s, r) => s + r.seats.length, 0);
  $("stTx").textContent = t.length;
}

function cancelReservation(ref) {
  const r = reservations.find(x => x.ref === ref);
  if (!r || r.status !== "Active") return;
  if (!confirm("Void transaction " + ref + "? The seats will be released.")) return;
  r.status = "Cancelled";
  r.voidedBy = cashier ? cashier.name : "";
  saveData();
  renderReservations();
  renderSeatMap();
}

function showView(id) {
  ["bookView", "resView"].forEach(v => { $(v).hidden = v !== id; });
  $("navBook").classList.toggle("active", id === "bookView");
  $("navRes").classList.toggle("active", id === "resView");
  if (id === "resView") renderReservations();
}

/* ---------- cashier ---------- */
const todayISO = () => {
  const n = new Date();
  return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const statusLabel = s => (s === "Active" ? "Paid" : "Voided");

function loadCashier() {
  try {
    cashier = JSON.parse(localStorage.getItem(CASHIER_KEY));
  } catch (e) {
    cashier = null;
  }
  updateCashierUI();
}

function updateCashierUI() {
  const signed = !!(cashier && cashier.name);
  $("login").hidden = signed;
  $("app").hidden = !signed;
  if (signed) $("cashierInfo").textContent = "Cashier: " + cashier.name + " | " + cashier.counter;
}

function signIn(e) {
  e.preventDefault();
  const name = $("cName").value.trim();
  if (!NAME_RULE[0](name)) {
    $("e_cName").textContent = "Enter the cashier's name (letters only).";
    return;
  }
  $("e_cName").textContent = "";
  cashier = { name: name, counter: $("cCounter").value };
  try { localStorage.setItem(CASHIER_KEY, JSON.stringify(cashier)); } catch (err) { /* ignore */ }
  updateCashierUI();
}

function signOut() {
  if (!confirm("End your shift and sign out?")) return;
  cashier = null;
  try { localStorage.removeItem(CASHIER_KEY); } catch (err) { /* ignore */ }
  clearSelection();
  closeModal();
  showView("bookView");
  $("cName").value = "";
  updateCashierUI();
}

/* ---------- payment ---------- */
function togglePayment() {
  const cash = $("payMethod").value === "Cash";
  $("cashRow").hidden = !cash;
  $("changeRow").hidden = !cash;
  updateChange();
}

function updateChange() {
  const total = selected.length * ticketPrice();
  const paid = Number($("fPaid").value) || 0;
  $("sChange").textContent = !paid ? "-" : paid >= total ? money(paid - total) : "Insufficient";
}