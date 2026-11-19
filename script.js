"use strict";

/* =====================================================
   1. DATA
   ===================================================== */

const DEFAULT_MOVIES = [
  {
    id: 1, title: "PBB", poster: "images/jeo_ong.png",
    genre: "Comedy", minutes: 124, price: 280, room: 2,
    times: ["11:00 AM", "2:30 PM", "8:00 PM"],
    description: "PBB COLLAB EDITION"
  },
  {
    id: 2, title: "Spiderman Brand New Day", poster: "images/praying.png",
    genre: "Sci-Fi", minutes: 112, price: 280, room: 1,
    times: ["10:00 AM", "1:30 PM", "7:00 PM"],
    description: "A forgotten Peter Parker protects New York alone, until a strange change in his body starts to threaten his existence, and the villains closing in on the city include one that no one can even see."
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

let movies = [];         // the movies currently showing (saved in the browser)
let editingId = null;    // id of the movie being edited (null = adding a new one)
let formTimes = [];      // showing times in the Add/Edit form, e.g. ["10:00 AM"]
let formPoster = "";     // poster picture (data URL) in the Add/Edit form
let transactions = [];   // every sale ever made (saved in the browser)
let selectedSeats = [];  // seats clicked right now, e.g. ["A1", "A2"]
let cashier = null;      // { name, counter } of the person signed in

const SALES_KEY = "cinema_transactions";
const CASHIER_KEY = "cinema_cashier";
const MOVIES_KEY = "cinema_movies";

// Shown when a movie has no picture
const NO_POSTER = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="350"><rect width="100%" height="100%" fill="#d9d9d9"/>' +
  '<text x="50%" y="50%" font-family="Arial" font-size="22" fill="#666" text-anchor="middle">No picture</text></svg>');

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
const currentMovie = () => movies.find((m) => m.id === Number($("movieSelect").value));

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
    const savedMovies = JSON.parse(localStorage.getItem(MOVIES_KEY));
    movies = Array.isArray(savedMovies) ? savedMovies : DEFAULT_MOVIES.map((m) => ({ ...m }));
    // Fix old saved poster paths (e.g. "imagesjeo_ong.png" or "images\\jeo_ong.png")
    movies.forEach((m) => {
      if (typeof m.poster === "string" && !m.poster.startsWith("data:")) {
        m.poster = m.poster.replace(/\\/g, "/");
        const def = DEFAULT_MOVIES.find((d) => d.id === m.id);
        if (def && /^images[^/]/.test(m.poster)) m.poster = def.poster;
      }
    });
    saveMovies();
  } catch (error) {
    movies = DEFAULT_MOVIES.map((m) => ({ ...m }));
  }

  try {
    transactions = JSON.parse(localStorage.getItem(SALES_KEY)) || [];
    cashier = JSON.parse(localStorage.getItem(CASHIER_KEY));
  } catch (error) {
    transactions = [];
    cashier = null;
  }
}

const saveTransactions = () => localStorage.setItem(SALES_KEY, JSON.stringify(transactions));

// Returns false if the browser storage is full (big pictures)
function saveMovies() {
  try {
    localStorage.setItem(MOVIES_KEY, JSON.stringify(movies));
    return true;
  } catch (error) {
    return false;
  }
}

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
  $("moviesPage").hidden = name !== "movies";
  $("tabSell").classList.toggle("active", name === "sell");
  $("tabTrans").classList.toggle("active", name === "trans");
  $("tabMovies").classList.toggle("active", name === "movies");

  if (name === "trans") showTransactions();
  if (name === "movies") showMovieList();
}

/* =====================================================
   6. SELL TICKETS PAGE
   ===================================================== */

// Runs when the movie changes: update poster, text and showtimes
function onMovieChange() {
  const movie = currentMovie();

  // no movies at all (all were removed)
  if (!movie) {
    selectedSeats = [];
    $("moviePoster").src = NO_POSTER;
    $("movieTitle").textContent = "No movies showing";
    $("movieMeta").textContent = "";
    $("movieDesc").textContent = "Go to Manage Movies to add a movie.";
    $("timeSelect").innerHTML = "";
    $("seatRows").innerHTML = "";
    $("screenSub").textContent = "";
    $("hall").hidden = true;
    updatePanel();
    return;
  }
  $("hall").hidden = false;

  $("moviePoster").src = movie.poster || NO_POSTER;
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
  if (!currentMovie()) return;
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

  // only the seats inside the hall (not the legend sample)
  document.querySelectorAll("#seatRows .seat.selected").forEach((b) => b.classList.remove("selected"));

  // also clear the customer / payment fields in the TRANSACTION box
  ["custName", "custContact", "cashInput"].forEach((id) => ($(id).value = ""));
  $("payMethod").value = "Cash";

  $("sellMessage").textContent = "";
  updatePanel();
}

// Total price = number of seats x price
const getTotal = () => (currentMovie() ? selectedSeats.length * currentMovie().price : 0);

// Update the TRANSACTION box on the right
function updatePanel() {
  const movie = currentMovie();

  $("tMovie").textContent = movie ? movie.title : "-";
  $("tWhen").textContent = movie ? $("dateInput").value + ", " + $("timeSelect").value : "-";
  $("tPrice").textContent = movie ? money(movie.price) : "-";
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
  if (!currentMovie()) {
    $("sellMessage").textContent = "There is no movie to sell. Add a movie first.";
    return;
  }
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
   9B. MANAGE MOVIES PAGE (add / edit / remove)
   ===================================================== */

// "13:30" -> "1:30 PM"
function to12Hour(value) {
  let [hour, minute] = value.split(":").map(Number);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return hour + ":" + String(minute).padStart(2, "0") + " " + ampm;
}

// "1:30 PM" -> 810 (minutes after midnight), used to sort showtimes
function timeToMinutes(text) {
  const match = text.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return 0;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

// Redraw the showtime "chips" in the form
function drawTimeChips() {
  formTimes.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  $("timeChips").innerHTML = formTimes.length
    ? formTimes.map((t, i) => `<span class="chip">${safe(t)} <button type="button" data-index="${i}" title="Remove time">&times;</button></span>`).join("")
    : '<span class="hint">No showing time yet.</span>';
}

function addTime() {
  const value = $("mTimeInput").value;
  if (!value) return;
  const time = to12Hour(value);
  if (formTimes.includes(time)) {
    $("movieMessage").textContent = time + " is already added.";
    return;
  }
  formTimes.push(time);
  $("mTimeInput").value = "";
  $("movieMessage").textContent = "";
  drawTimeChips();
}

function onChipClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  formTimes.splice(Number(button.dataset.index), 1);
  drawTimeChips();
}

// Shrink the picture so it fits in the browser storage, then keep it as a data URL
function onPosterChosen() {
  const file = $("mPoster").files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    $("movieMessage").textContent = "Please choose an image file (JPG, PNG, ...).";
    $("mPoster").value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 400 / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      formPoster = canvas.toDataURL("image/jpeg", 0.8);
      $("posterPreview").src = formPoster;
      $("posterPreview").hidden = false;
      $("movieMessage").textContent = "";
    };
    img.onerror = () => ($("movieMessage").textContent = "That picture could not be read. Try another one.");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// Put the form back to "Add Movie" with empty fields
function resetMovieForm() {
  editingId = null;
  formTimes = [];
  formPoster = "";
  ["mTitle", "mGenre", "mMinutes", "mPrice", "mRoom", "mTimeInput", "mDesc", "mPoster"].forEach((id) => ($(id).value = ""));
  $("posterPreview").hidden = true;
  $("movieFormTitle").textContent = "ADD MOVIE";
  $("saveMovieBtn").textContent = "Add Movie";
  $("cancelEditBtn").hidden = true;
  $("movieMessage").textContent = "";
  drawTimeChips();
}

// Returns an error message, or "" if the form is fine
function getMovieError(movie) {
  if (movie.title.length < 2) return "Please enter the movie title.";
  if (movies.some((m) => m.id !== editingId && m.title.toLowerCase() === movie.title.toLowerCase())) return "That movie is already in the list.";
  if (movie.genre === "") return "Please enter the genre.";
  if (!(movie.minutes >= 1 && movie.minutes <= 600)) return "Duration must be 1 to 600 minutes.";
  if (!(movie.price > 0)) return "Please enter the ticket price.";
  if (!(movie.room >= 1)) return "Please enter the cinema number.";
  if (movie.times.length === 0) return "Add at least one showing time.";
  if (movie.description === "") return "Please enter the description.";
  return "";
}

function saveMovie() {
  const movie = {
    id: editingId || Date.now(),
    title: $("mTitle").value.trim(),
    poster: formPoster,
    genre: $("mGenre").value.trim(),
    minutes: Math.round(Number($("mMinutes").value)),
    price: Number($("mPrice").value),
    room: Math.round(Number($("mRoom").value)),
    times: [...formTimes],
    description: $("mDesc").value.trim()
  };

  const error = getMovieError(movie);
  if (error) {
    $("movieMessage").textContent = error;
    return;
  }

  const backup = movies.map((m) => ({ ...m }));
  const index = movies.findIndex((m) => m.id === editingId);
  if (index >= 0) movies[index] = movie;
  else movies.push(movie);

  if (!saveMovies()) {
    movies = backup; // storage full: undo
    $("movieMessage").textContent = "Storage is full. Try a smaller picture or remove an old movie.";
    return;
  }

  resetMovieForm();
  refreshMovieSelect();
  showMovieList();
}

// Load a movie into the form so it can be changed
function startEdit(id) {
  const movie = movies.find((m) => m.id === id);
  if (!movie) return;

  resetMovieForm();
  editingId = id;
  formTimes = [...movie.times];
  formPoster = movie.poster || "";

  $("mTitle").value = movie.title;
  $("mGenre").value = movie.genre;
  $("mMinutes").value = movie.minutes;
  $("mPrice").value = movie.price;
  $("mRoom").value = movie.room;
  $("mDesc").value = movie.description;
  $("posterPreview").src = formPoster || NO_POSTER;
  $("posterPreview").hidden = false;

  $("movieFormTitle").textContent = "EDIT MOVIE";
  $("saveMovieBtn").textContent = "Save Changes";
  $("cancelEditBtn").hidden = false;
  drawTimeChips();
  $("movieFormTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function removeMovie(id) {
  const movie = movies.find((m) => m.id === id);
  if (!movie) return;

  // upcoming paid tickets for this movie
  const upcoming = transactions.filter((t) => t.status === "Paid" && t.showKey.split("|")[0] === String(id) && t.date >= today()).length;
  let question = 'Remove "' + movie.title + '" from the list?';
  if (upcoming > 0) question += "\n\nWarning: it still has " + upcoming + " paid transaction(s) for today or later dates. Those records stay in Transactions.";
  if (!confirm(question)) return;

  movies = movies.filter((m) => m.id !== id);
  saveMovies();
  if (editingId === id) resetMovieForm();
  refreshMovieSelect();
  showMovieList();
}

// One movie card in the list
function movieCard(m) {
  return `<div class="movie-card">
    <img src="${m.poster || NO_POSTER}" alt="">
    <div class="movie-card-info">
      <h3>${safe(m.title)}</h3>
      <p class="meta">${safe(m.genre)} | ${m.minutes} min | ${money(m.price)} | Cinema ${m.room}</p>
      <p class="times">${m.times.map((t) => `<span class="chip">${safe(t)}</span>`).join(" ")}</p>
      <p class="desc">${safe(m.description)}</p>
      <button type="button" class="small-btn" data-action="edit" data-id="${m.id}">Edit</button>
      <button type="button" class="small-btn void" data-action="remove" data-id="${m.id}">Remove</button>
    </div>
  </div>`;
}

function showMovieList() {
  $("movieCount").textContent = movies.length;
  $("movieList").innerHTML = movies.length ? movies.map(movieCard).join("") : '<p class="hint">No movies yet. Add one using the form.</p>';
}

function onMovieListClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const id = Number(button.dataset.id);
  if (button.dataset.action === "edit") startEdit(id);
  if (button.dataset.action === "remove") removeMovie(id);
}

// Rebuild the Movie dropdown on the Sell page (keeps the chosen movie if it still exists)
function refreshMovieSelect() {
  const previous = $("movieSelect").value;
  $("movieSelect").innerHTML = movies.map((m) => `<option value="${m.id}">${safe(m.title)}</option>`).join("");
  if (movies.some((m) => String(m.id) === previous)) $("movieSelect").value = previous;
  onMovieChange();
}

/* =====================================================
   10. START THE APP (connect buttons to functions)
   ===================================================== */

function startApp() {
  loadData();

  // set up the sell page
  $("dateInput").value = today();
  $("dateInput").min = today();
  refreshMovieSelect();
  drawTimeChips();

  // sign in / out
  $("loginForm").addEventListener("submit", signIn);
  $("signOutBtn").addEventListener("click", signOut);

  // tabs
  $("tabSell").addEventListener("click", () => showPage("sell"));
  $("tabTrans").addEventListener("click", () => showPage("trans"));
  $("tabMovies").addEventListener("click", () => showPage("movies"));

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

  // manage movies page
  $("addTimeBtn").addEventListener("click", addTime);
  $("timeChips").addEventListener("click", onChipClick);
  $("mPoster").addEventListener("change", onPosterChosen);
  $("saveMovieBtn").addEventListener("click", saveMovie);
  $("cancelEditBtn").addEventListener("click", resetMovieForm);
  $("movieList").addEventListener("click", onMovieListClick);

  // receipt popup
  $("printBtn").addEventListener("click", () => window.print());
  $("toTransBtn").addEventListener("click", () => { closeReceipt(); showPage("trans"); });
  $("newSaleBtn").addEventListener("click", () => { closeReceipt(); showPage("sell"); });

  showCorrectScreen();
}

startApp();
