const SUPABASE_URL = "https://bnekbuwfloagqjzselxp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Xs8qdDm4RTa2Adjw34SLKw_rS-c-ikB";
const FACEBOOK_URL = "https://www.facebook.com/share/19JD1ACiCu/";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const calendar = document.getElementById("calendar");
const monthLabel = document.getElementById("monthLabel");
const slotsEl = document.getElementById("slots");
const selectedDateText = document.getElementById("selectedDateText");
const summaryText = document.getElementById("summaryText");
const bookButton = document.getElementById("bookButton");

let view = new Date();
view.setDate(1);
let selectedDate = null;
let selectedTime = null;
let selectedPackage = null;
let selectedRate = null;
let scheduleMap = new Map();

const pad = n => String(n).padStart(2, "0");
const keyDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const niceDate = d => d.toLocaleDateString("en-PH", {weekday:"long", month:"long", day:"numeric", year:"numeric"});
const hourLabel = h => {
  const fmt = x => x === 24 ? "12:00 MN" : `${x%12 || 12}:00 ${x<12 ? "AM" : "PM"}`;
  return `${fmt(h)} – ${fmt(h+1)}`;
};

async function loadMonthSchedule() {
  const start = new Date(view.getFullYear(), view.getMonth(), 1);
  const end = new Date(view.getFullYear(), view.getMonth()+1, 0);
  const { data, error } = await db
    .from("public_schedule")
    .select("slot_date,start_hour,status")
    .gte("slot_date", keyDate(start))
    .lte("slot_date", keyDate(end));

  scheduleMap = new Map();
  if (error) {
    console.error("Schedule load error:", error);
  } else {
    (data || []).forEach(r => scheduleMap.set(`${r.slot_date}|${r.start_hour}`, r.status));
  }
  renderCalendar();
  renderSlots();
}

function statusFor(dateStr, hour) {
  return scheduleMap.get(`${dateStr}|${hour}`) || "available";
}

function renderCalendar() {
  calendar.innerHTML = "";
  monthLabel.textContent = view.toLocaleDateString("en-PH", {month:"long", year:"numeric"});
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y,m,1).getDay();
  const days = new Date(y,m+1,0).getDate();
  const today = new Date();
  today.setHours(0,0,0,0);

  for (let i=0; i<first; i++) {
    const blank = document.createElement("span");
    blank.className = "day blank";
    calendar.appendChild(blank);
  }

  for (let n=1; n<=days; n++) {
    const d = new Date(y,m,n);
    const btn = document.createElement("button");
    btn.className = "day";
    btn.textContent = n;
    if (d < today) btn.classList.add("past");
    if (d.getTime() === today.getTime()) btn.classList.add("today");
    if (selectedDate && keyDate(d) === keyDate(selectedDate)) btn.classList.add("selected");
    const dot = document.createElement("i");
    dot.className = "mini-dot";
    btn.appendChild(dot);
    if (d >= today) {
      btn.onclick = () => {
        selectedDate = d;
        selectedTime = null;
        renderCalendar();
        renderSlots();
        updateSummary();
      };
    }
    calendar.appendChild(btn);
  }
}

function renderSlots() {
  slotsEl.innerHTML = "";
  if (!selectedDate) {
    selectedDateText.textContent = "Choose a date";
    return;
  }
  const ds = keyDate(selectedDate);
  selectedDateText.textContent = niceDate(selectedDate);

  for (let h=8; h<24; h++) {
    const b = document.createElement("button");
    const status = statusFor(ds, h);
    b.className = "slot";
    b.textContent = hourLabel(h);
    if (status === "booked") {
      b.classList.add("booked");
      b.disabled = true;
    } else if (status === "unavailable") {
      b.classList.add("unavailable");
      b.disabled = true;
    } else {
      if (selectedTime === h) b.classList.add("active");
      b.onclick = () => {
        selectedTime = h;
        renderSlots();
        updateSummary();
      };
    }
    slotsEl.appendChild(b);
  }
}

document.querySelectorAll(".package-options button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".package-options button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    selectedPackage = b.dataset.package;
    selectedRate = b.dataset.rate;
    updateSummary();
  };
});

function updateSummary() {
  if (selectedDate && selectedTime !== null && selectedPackage) {
    summaryText.textContent = `${niceDate(selectedDate)} • ${hourLabel(selectedTime)} • ${selectedPackage} • ${selectedRate}`;
    bookButton.href = FACEBOOK_URL;
    bookButton.classList.remove("disabled");
  } else {
    summaryText.textContent = "Select a date, time, and coaching type.";
    bookButton.href = "#";
    bookButton.classList.add("disabled");
  }
}

document.getElementById("prevMonth").onclick = () => {
  view.setMonth(view.getMonth()-1);
  selectedDate = null;
  selectedTime = null;
  loadMonthSchedule();
};

document.getElementById("nextMonth").onclick = () => {
  view.setMonth(view.getMonth()+1);
  selectedDate = null;
  selectedTime = null;
  loadMonthSchedule();
};

loadMonthSchedule();
