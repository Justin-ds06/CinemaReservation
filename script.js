"use strict";

/* =====================================================
   1. DATA
   ===================================================== */

const MOVIES = [
  {
    id: 1, title: "He's Dating a Boldstar", poster: "images/malupiton.jpg",
    genre: "Romcom", minutes: 112, price: 280, room: 1,
    times: ["10:00 AM", "1:30 PM", "7:00 PM"],
    description: "A shy office worker falls for a rising star, and love gets messy and funny."
  },
  {
    id: 2, title: "Spiderman Brand New Day", poster: "images/spiderman.jpg",
    genre: "Sci-Fi", minutes: 124, price: 280, room: 2,
    times: ["11:00 AM", "2:30 PM", "8:00 PM"],
    description: "Peter Parker starts over as a new threat rises in the city."
  },
  {
    id: 3, title: "Avengers Doomsday", poster: "images/avengers.jpg",
    genre: "Drama", minutes: 105, price: 350, room: 3,
    times: ["12:00 PM", "4:00 PM", "9:00 PM"],
    description: "Earth's heroes unite against their most dangerous enemy yet."
  }
];

// Seats per row: [left block, right block]. Numbers keep counting across the aisle.
const LAYOUT = { A: [3, 3], B: [4, 4], C: [4, 4], D: [5, 5], E: [6, 6], F: [6, 6], G: [6, 6], H: [6, 6] };

let transactions = [];   // every sale ever made (saved in the browser)
let selectedSeats = [];  // seats clicked right now, e.g. ["A1", "A2"]
let cashier = null;      // { name, counter } of the person signed in

const SALES_KEY = "cinema_transactions";
const CASHIER_KEY = "cinema_cashier";

/* =====================================================
   2. SMALL HELPERS
   ===================================================== */

const $ = (id) => document.getElementById(id);

// 280 -> "PHP 280.00"
const money = (amount) =>
  "PHP " + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Today's date as "2026-11-10"
const today = () => new Date().toLocaleDateString("en-CA");

// The movie chosen in the dropdown
const currentMovie = () => MOVIES.find((m) => m.id === Number($("movieSelect").value));

// Identifies one show (movie + date + time), so we know which seats are sold for THIS show
const showKey = () => $("movieSelect").value + "|" + $("dateInput").value + "|" + $("timeSelect").value;

// Seats in order, e.g. ["A2", "A1"] -> ["A1", "A2"]
const sortedSeats = () => [...selectedSeats].sort();

// Stops HTML tricks in typed text (e.g. someone typing <b>)
function safe(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const findSale = (ref) => transactions.find((t) => t.ref === ref);

/* =====================================================
   3. SAVE / LOAD (localStorage keeps data after refresh)
   ===================================================== */

function loadData() {
  try {
    transactions = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    cashier = JSON.parse(localStorage.getItem(CASHIER_KEY));
  } catch (error) {
    transactions = [];
    cashier = null;
  }
}

const saveTransactions = () => localStorage.setItem(SALES_KEY, JSON.stringify(transactions));

/* =====================================================
   4. SIGN IN / SIGN OUT
   ===================================================== */

function showCorrectScreen() {
  $("loginPage").hidden = cashier !== null;
  $("app").hidden = cashier === null;

  if (cashier) {
    $("cashierLabel").textContent = "Cashier: " + cashier.name + " | " + cashier.counter;
    $("counterLabel").textContent = "• Ticket Counter";
  }
}

function signIn(event) {
  event.preventDefault(); // stop the page from reloading
  const name = $("cashierName").value.trim();

  if (name.length < 2) {
    $("loginError").textContent = "Please enter the cashier name.";
    return;
  }
  cashier = { name: name, counter: $("counterSelect").value };
  localStorage.setItem(CASHIER_KEY, JSON.stringify(cashier));
  $("loginError").textContent = "";
  showCorrectScreen();
}

function signOut() {
  if (!confirm("End your shift and sign out?")) return;
  cashier = null;
  localStorage.removeItem(CASHIER_KEY);
  $("cashierName").value = "";
  clearSelection();
  showPage("sell");
  showCorrectScreen();
}

/* =====================================================
   5. PAGES (Sell Tickets / Transactions)
   ===================================================== */

function showPage(name) {
  $("sellPage").hidden = name !== "sell";
  $("transPage").hidden = name !== "trans";
  $("tabSell").classList.toggle("active", name === "sell");
  $("tabTrans").classList.toggle("active", name === "trans");

  if (name === "trans") showTransactions();
}

/* =====================================================
   6. SELL TICKETS PAGE
   ===================================================== */

// Runs when the movie changes: update poster, text and showtimes
function onMovieChange() {
  const movie = currentMovie();

  $("moviePoster").src = movie.poster;
  $("movieTitle").textContent = movie.title;
  $("movieMeta").textContent = movie.genre + " | " + movie.minutes + " min";
  $("movieDesc").textContent = movie.description;
  $("timeSelect").innerHTML = movie.times.map((t) => `<option>${t}</option>`).join("");

  drawSeats();
}

// Seats already sold (and not voided) for the current show
function getSoldSeats() {
  return transactions
    .filter((t) => t.status === "Paid" && t.showKey === showKey())
    .flatMap((t) => t.seats);
}

// HTML for a group of seat buttons, numbered from "start"
function seatButtons(letter, start, count, sold) {
  let html = "";
  for (let number = start; number < start + count; number++) {
    const id = letter + number;
    const isSold = sold.includes(id);
    html += `<button type="button" class="seat${isSold ? " sold" : ""}" data-seat="${id}" ${isSold ? "disabled" : ""}>${number}</button>`;
  }
  return html;
}

// Draw all seat rows
function drawSeats() {
  selectedSeats = [];
  const sold = getSoldSeats();
  let html = "";

  for (const letter in LAYOUT) {
    const [left, right] = LAYOUT[letter];
    html += `<div class="row"><span class="row-letter">${letter}</span>` +
      `<div class="block left-block">${seatButtons(letter, 1, left, sold)}</div>` +
      `<div class="block right-block">${seatButtons(letter, left + 1, right, sold)}</div></div>`;
  }
  $("seatRows").innerHTML = html;
  $("screenSub").textContent = $("timeSelect").value + " @ CINEMA " + currentMovie().room;

  updatePanel();
}

// Runs when a seat is clicked: select it, or unselect it if already selected
function onSeatClick(event) {
  const button = event.target.closest(".seat");
  if (!button || button.disabled) return;

  const id = button.dataset.seat;
  if (selectedSeats.includes(id)) {
    selectedSeats = selectedSeats.filter((s) => s !== id);
  } else {
    selectedSeats.push(id);
  }
  button.classList.toggle("selected");
  $("sellMessage").textContent = "";
  updatePanel();
}

function clearSelection() {
  selectedSeats = [];
  document.querySelectorAll(".seat.selected").forEach((b) => b.classList.remove("selected"));
  $("sellMessage").textContent = "";
  updatePanel();
}

// Total price = number of seats x price
const getTotal = () => selectedSeats.length * currentMovie().price;

// Update the TRANSACTION box on the right
function updatePanel() {
  const movie = currentMovie();

  $("tMovie").textContent = movie.title;
  $("tWhen").textContent = $("dateInput").value + ", " + $("timeSelect").value;
  $("tPrice").textContent = money(movie.price);
  $("tSeats").textContent = selectedSeats.length ? sortedSeats().join(", ") : "-";
  $("tTotal").textContent = money(getTotal());
  $("cashBox").hidden = $("payMethod").value !== "Cash"; // cash only: show change

  updateChange();
}

function updateChange() {
  const cash = Number($("cashInput").value);
  const total = getTotal();

  if (!cash || !total) $("tChange").textContent = "-";
  else if (cash < total) $("tChange").textContent = "Short by " + money(total - cash);
  else $("tChange").textContent = money(cash - total);
}

/* =====================================================
   7. CHARGE (check the form, then save the sale)
   ===================================================== */

// Returns an error message, or "" if everything is fine
function getSaleError(total, method, contact, cash) {
  if (selectedSeats.length === 0) return "Please select at least one seat.";
  if ($("dateInput").value < today()) return "You cannot sell tickets for a past date.";
  if (contact !== "" && !/^09\d{9}$/.test(contact)) return "Contact number must be 11 digits and start with 09.";
  if (method === "Cash" && cash < total) return "Cash received is less than the total.";
  return "";
}

// Next reference: CS-0001, CS-0002, ...
function makeRef() {
  const highest = Math.max(0, ...transactions.map((t) => Number(t.ref.replace("CS-", ""))));
  return "CS-" + String(highest + 1).padStart(4, "0");
}

function charge() {
  const total = getTotal();
  const method = $("payMethod").value;
  const contact = $("custContact").value.trim();
  const cash = Number($("cashInput").value);

  const error = getSaleError(total, method, contact, cash);
  if (error) {
    $("sellMessage").textContent = error;
    return;
  }

  const movie = currentMovie();
  const sale = {
    ref: makeRef(),
    showKey: showKey(),
    customer: $("custName").value.trim() || "Walk-in",
    contact: contact,
    movie: movie.title,
    date: $("dateInput").value,
    time: $("timeSelect").value,
    room: movie.room,
    seats: sortedSeats(),
    price: movie.price,
    total: total,
    method: method,
    cash: method === "Cash" ? cash : total,
    change: method === "Cash" ? cash - total : 0,
    cashier: cashier.name,
    counter: cashier.counter,
    status: "Paid",
    soldOn: today(),
    issued: new Date().toLocaleString()
  };
  transactions.push(sale);
  saveTransactions();

  // reset the form
  ["custName", "custContact", "cashInput"].forEach((id) => ($(id).value = ""));
  $("sellMessage").textContent = "";

  drawSeats(); // the seats are now sold
  showReceipt(sale.ref);
}

/* =====================================================
   8. RECEIPT
   ===================================================== */

// One line of the receipt: label on the left, value on the right
const line = (label, value, css = "") => `<div class="line ${css}"><span>${label}</span><span>${value}</span></div>`;

function showReceipt(ref) {
  const t = findSale(ref);
  if (!t) return;

  const cashLines = t.method === "Cash" ? line("Cash", money(t.cash)) + line("Change", money(t.change)) : "";

  $("receipt").innerHTML =
    "<h2>CINEMA SEAT RESERVATION</h2>" +
    '<p class="center">Ticket Receipt</p><hr>' +
    `<div class="ref">${t.ref}</div>` +
    `<p class="center">${safe(t.issued)}</p>` +
    `<p class="center">Cashier: ${safe(t.cashier)} (${safe(t.counter)})</p><hr>` +
    line("Customer", safe(t.customer)) +
    line("Movie", safe(t.movie)) +
    line("Date", t.date) +
    line("Time", t.time) +
    line("Cinema", t.room) +
    line("Seats", t.seats.join(", ")) + "<hr>" +
    line(t.seats.length + " x " + money(t.price), money(t.total)) +
    line("TOTAL", money(t.total), "bold") +
    line("Payment", t.method) +
    cashLines +
    `<p class="center">Status: <b>${t.status.toUpperCase()}</b></p><hr>` +
    '<p class="center">Please arrive 15 minutes before showtime. Thank you!</p>';

  $("receiptModal").hidden = false;
}

const closeReceipt = () => ($("receiptModal").hidden = true);

/* =====================================================
   9. TRANSACTIONS PAGE
   ===================================================== */

// One table row
function transactionRow(t) {
  const voidButton = t.status === "Paid"
    ? `<button class="small-btn void" data-action="void" data-ref="${t.ref}">Void</button>`
    : "";

  return `<tr>
    <td>${t.ref}</td>
    <td>${safe(t.customer)}</td>
    <td>${safe(t.movie)}</td>
    <td>${t.date} ${t.time}</td>
    <td>${t.seats.join(", ")}</td>
    <td>${money(t.total)}</td>
    <td>${t.method}</td>
    <td>${safe(t.cashier)}</td>
    <td class="${t.status === "Voided" ? "voided" : ""}">${t.status}</td>
    <td><button class="small-btn" data-action="receipt" data-ref="${t.ref}">Receipt</button> ${voidButton}</td>
  </tr>`;
}

function showTransactions() {
  // top boxes: today's PAID sales only
  const todaysSales = transactions.filter((t) => t.status === "Paid" && t.soldOn === today());

  $("statSales").textContent = money(todaysSales.reduce((sum, t) => sum + t.total, 0));
  $("statTickets").textContent = todaysSales.reduce((sum, t) => sum + t.seats.length, 0);
  $("statCount").textContent = todaysSales.length;

  // table: apply search + status filter, newest on top
  const search = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;

  const rows = transactions
    .filter((t) => status === "All" || t.status === status)
    .filter((t) => t.customer.toLowerCase().includes(search) || t.ref.toLowerCase().includes(search))
    .reverse()
    .map(transactionRow)
    .join("");

  $("transBody").innerHTML = rows || '<tr><td colspan="10">No transactions found.</td></tr>';
}

// Receipt / Void buttons inside the table
function onTableClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const ref = button.dataset.ref;

  if (button.dataset.action === "receipt") showReceipt(ref);

  if (button.dataset.action === "void") {
    if (!confirm("Void transaction " + ref + "? The seats will be released.")) return;
    const sale = findSale(ref);
    sale.status = "Voided";
    sale.voidedBy = cashier.name;
    saveTransactions();
    showTransactions();
    drawSeats(); // sold seats become available again
  }
}

/* =====================================================
   10. START THE APP (connect buttons to functions)
   ===================================================== */

function startApp() {
  loadData();

  // set up the sell page
  $("movieSelect").innerHTML = MOVIES.map((m) => `<option value="${m.id}">${safe(m.title)}</option>`).join("");
  $("dateInput").value = today();
  $("dateInput").min = today();
  onMovieChange();

  // sign in / out
  $("loginForm").addEventListener("submit", signIn);
  $("signOutBtn").addEventListener("click", signOut);

  // tabs
  $("tabSell").addEventListener("click", () => showPage("sell"));
  $("tabTrans").addEventListener("click", () => showPage("trans"));

  // sell page
  $("movieSelect").addEventListener("change", onMovieChange);
  $("dateInput").addEventListener("change", drawSeats);
  $("timeSelect").addEventListener("change", drawSeats);
  $("seatRows").addEventListener("click", onSeatClick);
  $("payMethod").addEventListener("change", updatePanel);
  $("cashInput").addEventListener("input", updateChange);
  $("chargeBtn").addEventListener("click", charge);
  $("clearBtn").addEventListener("click", clearSelection);

  // transactions page
  $("searchInput").addEventListener("input", showTransactions);
  $("statusFilter").addEventListener("change", showTransactions);
  $("transBody").addEventListener("click", onTableClick);

  // receipt popup
  $("printBtn").addEventListener("click", () => window.print());
  $("toTransBtn").addEventListener("click", () => { closeReceipt(); showPage("trans"); });
  $("newSaleBtn").addEventListener("click", () => { closeReceipt(); showPage("sell"); });

  showCorrectScreen();
}

startApp();
