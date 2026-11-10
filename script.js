"use strict";

/* =====================================================
   1. DATA  (edit movies, prices and seat layout here)
   ===================================================== */

const MOVIES = [
  {
    id: 1,
    title: "He's Dating a Boldstar",
    poster: "images/malupiton.jpg",
    genre: "Romcom",
    minutes: 112,
    price: 280,
    room: 1,
    times: ["10:00 AM", "1:30 PM", "7:00 PM"],
    description: "A shy office worker falls for a rising star, and love gets messy and funny."
  },
  {
    id: 2,
    title: "Spiderman Brand New Day",
    poster: "images/spiderman.jpg",
    genre: "Sci-Fi",
    minutes: 124,
    price: 280,
    room: 2,
    times: ["11:00 AM", "2:30 PM", "8:00 PM"],
    description: "Peter Parker starts over as a new threat rises in the city."
  },
  {
    id: 3,
    title: "Avengers Doomsday",
    poster: "images/avengers.jpg",
    genre: "Drama",
    minutes: 105,
    price: 350,
    room: 3,
    times: ["12:00 PM", "4:00 PM", "9:00 PM"],
    description: "Earth's heroes unite against their most dangerous enemy yet."
  }
];

// Seat layout: [seats on the left block, seats on the right block]
// Seat numbers keep counting across the aisle (A: 1-3 left, 4-6 right)
const LAYOUT = {
  A: [3, 3],
  B: [4, 4],
  C: [4, 4],
  D: [5, 5],
  E: [6, 6],
  F: [6, 6],
  G: [6, 6],
  H: [6, 6]
};

/* =====================================================
   2. VARIABLES
   ===================================================== */

let transactions = [];     // every sale ever made (saved in the browser)
let selectedSeats = [];    // seats clicked right now, e.g. ["A1", "A2"]
let cashier = null;        // { name, counter } of the person signed in

const SALES_KEY = "cinema_transactions";
const CASHIER_KEY = "cinema_cashier";

// Shortcut so we can write $("id") instead of document.getElementById("id")
function $(id) {
  return document.getElementById(id);
}

/* =====================================================
   3. SMALL HELPER FUNCTIONS
   ===================================================== */

// 280 -> "PHP 280.00"
function money(amount) {
  return "PHP " + amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Today's date as "2026-11-10"
function today() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

// The movie currently chosen in the dropdown
function currentMovie() {
  return MOVIES.find(function (m) {
    return m.id === Number($("movieSelect").value);
  });
}

// A text that identifies one show: movie + date + time
// Used to know which seats are already sold for THIS show
function showKey() {
  return $("movieSelect").value + "|" + $("dateInput").value + "|" + $("timeSelect").value;
}

// Stop HTML tricks in names (e.g. someone typing <b>)
function safe(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* =====================================================
   4. SAVE / LOAD  (localStorage keeps data after refresh)
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

function saveTransactions() {
  localStorage.setItem(SALES_KEY, JSON.stringify(transactions));
}

/* =====================================================
   5. SIGN IN / SIGN OUT
   ===================================================== */

function showCorrectScreen() {
  const signedIn = cashier !== null;
  $("loginPage").hidden = signedIn;
  $("app").hidden = !signedIn;

  if (signedIn) {
    $("cashierLabel").textContent = "Cashier: " + cashier.name + " | " + cashier.counter;
    $("counterLabel").textContent = "• Ticket Counter";
  }
}

function signIn(event) {
  event.preventDefault();   // stop the page from reloading
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
   6. PAGES (Sell Tickets / Transactions)
   ===================================================== */

function showPage(name) {
  $("sellPage").hidden = name !== "sell";
  $("transPage").hidden = name !== "trans";
  $("tabSell").classList.toggle("active", name === "sell");
  $("tabTrans").classList.toggle("active", name === "trans");

  if (name === "trans") showTransactions();
}

/* =====================================================
   7. SELL TICKETS PAGE
   ===================================================== */

// Fill the movie dropdown (runs once)
function fillMovieDropdown() {
  let html = "";
  MOVIES.forEach(function (m) {
    html += '<option value="' + m.id + '">' + safe(m.title) + "</option>";
  });
  $("movieSelect").innerHTML = html;
}

// Runs when the movie changes: update poster, text, showtimes
function onMovieChange() {
  const movie = currentMovie();

  $("moviePoster").src = movie.poster;
  $("movieTitle").textContent = movie.title;
  $("movieMeta").textContent = movie.genre + " | " + movie.minutes + " min";
  $("movieDesc").textContent = movie.description;

  let html = "";
  movie.times.forEach(function (t) {
    html += "<option>" + t + "</option>";
  });
  $("timeSelect").innerHTML = html;

  drawSeats();
}

// Get the list of seats already sold for the current show
function getSoldSeats() {
  let sold = [];
  transactions.forEach(function (t) {
    if (t.status === "Paid" && t.showKey === showKey()) {
      sold = sold.concat(t.seats);
    }
  });
  return sold;
}

// Draw all seat buttons
function drawSeats() {
  selectedSeats = [];
  const sold = getSoldSeats();
  let html = "";

  // Go through each row letter: A, B, C ...
  for (const letter in LAYOUT) {
    const leftCount = LAYOUT[letter][0];
    const rightCount = LAYOUT[letter][1];
    let number = 1;

    html += '<div class="row"><span class="row-letter">' + letter + "</span>";

    // left block
    html += '<div class="block left-block">';
    for (let i = 0; i < leftCount; i++) {
      html += seatButton(letter, number, sold);
      number++;
    }
    html += "</div>";

    // right block
    html += '<div class="block right-block">';
    for (let i = 0; i < rightCount; i++) {
      html += seatButton(letter, number, sold);
      number++;
    }
    html += "</div></div>";
  }

  $("seatRows").innerHTML = html;

  // The text under "SCREEN MONITOR"
  const movie = currentMovie();
  $("screenSub").textContent = $("timeSelect").value + " @ CINEMA " + movie.room;

  updatePanel();
}

// One seat button as HTML text
function seatButton(letter, number, sold) {
  const id = letter + number;
  const isSold = sold.includes(id);
  const css = isSold ? "seat sold" : "seat";
  const disabled = isSold ? "disabled" : "";
  return '<button type="button" class="' + css + '" data-seat="' + id + '" ' + disabled + ">" + number + "</button>";
}

// Runs when a seat is clicked
function onSeatClick(event) {
  const button = event.target.closest(".seat");
  if (!button || button.disabled) return;

  const id = button.dataset.seat;

  if (selectedSeats.includes(id)) {
    // already selected -> unselect it
    selectedSeats = selectedSeats.filter(function (s) { return s !== id; });
    button.classList.remove("selected");
  } else {
    selectedSeats.push(id);
    button.classList.add("selected");
  }
  $("sellMessage").textContent = "";
  updatePanel();
}

function clearSelection() {
  selectedSeats = [];
  document.querySelectorAll(".seat.selected").forEach(function (b) {
    b.classList.remove("selected");
  });
  $("sellMessage").textContent = "";
  updatePanel();
}

// Total price = number of seats x price
function getTotal() {
  return selectedSeats.length * currentMovie().price;
}

// Update the grey TRANSACTION box on the right
function updatePanel() {
  const movie = currentMovie();

  $("tMovie").textContent = movie.title;
  $("tWhen").textContent = $("dateInput").value + ", " + $("timeSelect").value;
  $("tPrice").textContent = money(movie.price);
  $("tSeats").textContent = selectedSeats.length ? selectedSeats.slice().sort().join(", ") : "-";
  $("tTotal").textContent = money(getTotal());

  // Cash only: show change
  $("cashBox").hidden = $("payMethod").value !== "Cash";
  updateChange();
}

function updateChange() {
  const cash = Number($("cashInput").value);
  const total = getTotal();

  if (!cash || !total) {
    $("tChange").textContent = "-";
  } else if (cash < total) {
    $("tChange").textContent = "Short by " + money(total - cash);
  } else {
    $("tChange").textContent = money(cash - total);
  }
}

/* =====================================================
   8. CHARGE (check the form, then save the sale)
   ===================================================== */

function charge() {
  const total = getTotal();
  const method = $("payMethod").value;
  const contact = $("custContact").value.trim();
  const cash = Number($("cashInput").value);

  // ---- checks ----
  if (selectedSeats.length === 0) {
    return showError("Please select at least one seat.");
  }
  if ($("dateInput").value < today()) {
    return showError("You cannot sell tickets for a past date.");
  }
  if (contact !== "" && !/^09\d{9}$/.test(contact)) {
    return showError("Contact number must be 11 digits and start with 09.");
  }
  if (method === "Cash" && cash < total) {
    return showError("Cash received is less than the total.");
  }

  // ---- create the transaction ----
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
    seats: selectedSeats.slice().sort(),
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

  // ---- reset the form ----
  $("custName").value = "";
  $("custContact").value = "";
  $("cashInput").value = "";
  $("sellMessage").textContent = "";

  drawSeats();         // the seats are now blue (sold)
  showReceipt(sale.ref);
}

function showError(text) {
  $("sellMessage").textContent = text;
}

// Make the next reference: CS-0001, CS-0002, ...
function makeRef() {
  let highest = 0;
  transactions.forEach(function (t) {
    const n = Number(t.ref.replace("CS-", ""));
    if (n > highest) highest = n;
  });
  return "CS-" + String(highest + 1).padStart(4, "0");
}

/* =====================================================
   9. RECEIPT
   ===================================================== */

function showReceipt(ref) {
  const t = transactions.find(function (x) { return x.ref === ref; });
  if (!t) return;

  let cashLines = "";
  if (t.method === "Cash") {
    cashLines =
      '<div class="line"><span>Cash</span><span>' + money(t.cash) + "</span></div>" +
      '<div class="line"><span>Change</span><span>' + money(t.change) + "</span></div>";
  }

  $("receipt").innerHTML =
    "<h2>ROBINSON CINEMA</h2>" +
    '<p class="center">Ticket Receipt</p><hr>' +
    '<div class="ref">' + t.ref + "</div>" +
    '<p class="center">' + safe(t.issued) + "</p>" +
    '<p class="center">Cashier: ' + safe(t.cashier) + " (" + safe(t.counter) + ")</p><hr>" +
    '<div class="line"><span>Customer</span><span>' + safe(t.customer) + "</span></div>" +
    '<div class="line"><span>Movie</span><span>' + safe(t.movie) + "</span></div>" +
    '<div class="line"><span>Date</span><span>' + t.date + "</span></div>" +
    '<div class="line"><span>Time</span><span>' + t.time + "</span></div>" +
    '<div class="line"><span>Cinema</span><span>' + t.room + "</span></div>" +
    '<div class="line"><span>Seats</span><span>' + t.seats.join(", ") + "</span></div><hr>" +
    '<div class="line"><span>' + t.seats.length + " x " + money(t.price) + "</span><span>" + money(t.total) + "</span></div>" +
    '<div class="line bold"><span>TOTAL</span><span>' + money(t.total) + "</span></div>" +
    '<div class="line"><span>Payment</span><span>' + t.method + "</span></div>" +
    cashLines +
    '<p class="center">Status: <b>' + t.status.toUpperCase() + "</b></p><hr>" +
    '<p class="center">Please arrive 15 minutes before showtime. Thank you!</p>';

  $("receiptModal").hidden = false;
}

function closeReceipt() {
  $("receiptModal").hidden = true;
}

/* =====================================================
   10. TRANSACTIONS PAGE
   ===================================================== */

function showTransactions() {
  // --- top boxes (only today's PAID sales) ---
  let sales = 0;
  let tickets = 0;
  let count = 0;

  transactions.forEach(function (t) {
    if (t.status === "Paid" && t.soldOn === today()) {
      sales += t.total;
      tickets += t.seats.length;
      count++;
    }
  });

  $("statSales").textContent = money(sales);
  $("statTickets").textContent = tickets;
  $("statCount").textContent = count;

  // --- table (apply search + status filter) ---
  const search = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  let rows = "";

  // show newest on top
  transactions.slice().reverse().forEach(function (t) {
    const matchStatus = status === "All" || t.status === status;
    const matchSearch =
      t.customer.toLowerCase().includes(search) ||
      t.ref.toLowerCase().includes(search);

    if (!matchStatus || !matchSearch) return;

    const voidButton = t.status === "Paid"
      ? '<button class="small-btn void" data-action="void" data-ref="' + t.ref + '">Void</button>'
      : "";

    rows +=
      "<tr>" +
      "<td>" + t.ref + "</td>" +
      "<td>" + safe(t.customer) + "</td>" +
      "<td>" + safe(t.movie) + "</td>" +
      "<td>" + t.date + " " + t.time + "</td>" +
      "<td>" + t.seats.join(", ") + "</td>" +
      "<td>" + money(t.total) + "</td>" +
      "<td>" + t.method + "</td>" +
      "<td>" + safe(t.cashier) + "</td>" +
      '<td class="' + (t.status === "Voided" ? "voided" : "") + '">' + t.status + "</td>" +
      '<td><button class="small-btn" data-action="receipt" data-ref="' + t.ref + '">Receipt</button> ' +
      voidButton + "</td>" +
      "</tr>";
  });

  if (rows === "") {
    rows = '<tr><td colspan="10">No transactions found.</td></tr>';
  }
  $("transBody").innerHTML = rows;
}

// Receipt / Void buttons inside the table
function onTableClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const ref = button.dataset.ref;

  if (button.dataset.action === "receipt") {
    showReceipt(ref);
  }

  if (button.dataset.action === "void") {
    if (!confirm("Void transaction " + ref + "? The seats will be released.")) return;
    const t = transactions.find(function (x) { return x.ref === ref; });
    t.status = "Voided";
    t.voidedBy = cashier.name;
    saveTransactions();
    showTransactions();
    drawSeats();    // sold seats become available again
  }
}

/* =====================================================
   11. START THE APP (connect buttons to functions)
   ===================================================== */

function startApp() {
  loadData();

  // set up the sell page
  fillMovieDropdown();
  $("dateInput").value = today();
  $("dateInput").min = today();
  onMovieChange();

  // sign in / out
  $("loginForm").addEventListener("submit", signIn);
  $("signOutBtn").addEventListener("click", signOut);

  // tabs
  $("tabSell").addEventListener("click", function () { showPage("sell"); });
  $("tabTrans").addEventListener("click", function () { showPage("trans"); });

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
  $("printBtn").addEventListener("click", function () { window.print(); });
  $("toTransBtn").addEventListener("click", function () { closeReceipt(); showPage("trans"); });
  $("newSaleBtn").addEventListener("click", function () { closeReceipt(); showPage("sell"); });

  showCorrectScreen();
}

startApp();
