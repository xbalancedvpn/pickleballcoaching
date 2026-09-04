const FACEBOOK_URL = "https://www.facebook.com/share/19JD1ACiCu/";

// Edit these lists later when a slot becomes booked or unavailable.
// Format: "YYYY-MM-DD|HH" where HH is the starting hour in 24-hour time.
// Example: "2026-09-05|18" means Sep 5, 6:00 PM–7:00 PM.
const BOOKED = new Set([]);
const UNAVAILABLE = new Set([]);

const calendar = document.getElementById("calendar");
const monthLabel = document.getElementById("monthLabel");
const slotsEl = document.getElementById("slots");
const selectedDateText = document.getElementById("selectedDateText");
const summaryText = document.getElementById("summaryText");
const bookButton = document.getElementById("bookButton");

let view = new Date();
view.setDate(1);
let selectedDate = null, selectedTime = null, selectedPackage = null, selectedRate = null;

const pad = n => String(n).padStart(2,"0");
const keyDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const niceDate = d => d.toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
const hourLabel = h => {
  const fmt = x => x === 24 ? "12:00 MN" : `${x%12 || 12}:00 ${x<12?"AM":"PM"}`;
  return `${fmt(h)} – ${fmt(h+1)}`;
};

function renderCalendar(){
  calendar.innerHTML="";
  monthLabel.textContent=view.toLocaleDateString("en-PH",{month:"long",year:"numeric"});
  const y=view.getFullYear(), m=view.getMonth();
  const first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);
  for(let i=0;i<first;i++){ const b=document.createElement("span"); b.className="day blank"; calendar.appendChild(b); }
  for(let n=1;n<=days;n++){
    const d=new Date(y,m,n), btn=document.createElement("button"); btn.className="day"; btn.textContent=n;
    if(d<today) btn.classList.add("past");
    if(d.getTime()===today.getTime()) btn.classList.add("today");
    if(selectedDate && keyDate(d)===keyDate(selectedDate)) btn.classList.add("selected");
    const dot=document.createElement("i"); dot.className="mini-dot"; btn.appendChild(dot);
    if(d>=today) btn.onclick=()=>{ selectedDate=d; selectedTime=null; renderCalendar(); renderSlots(); updateSummary(); };
    calendar.appendChild(btn);
  }
}

function renderSlots(){
  slotsEl.innerHTML="";
  if(!selectedDate){ selectedDateText.textContent="Choose a date"; return; }
  selectedDateText.textContent=niceDate(selectedDate);
  for(let h=8;h<24;h++){
    const b=document.createElement("button"); b.className="slot"; b.textContent=hourLabel(h);
    const k=`${keyDate(selectedDate)}|${h}`;
    if(BOOKED.has(k)){ b.classList.add("booked"); b.title="Booked"; }
    else if(UNAVAILABLE.has(k)){ b.classList.add("unavailable"); b.title="Unavailable"; }
    else {
      if(selectedTime===h) b.classList.add("active");
      b.onclick=()=>{selectedTime=h; renderSlots(); updateSummary();};
    }
    slotsEl.appendChild(b);
  }
}

document.querySelectorAll(".package-options button").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll(".package-options button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); selectedPackage=b.dataset.package; selectedRate=b.dataset.rate; updateSummary();
  };
});

function updateSummary(){
  if(selectedDate && selectedTime!==null && selectedPackage){
    const text=`${niceDate(selectedDate)} • ${hourLabel(selectedTime)} • ${selectedPackage} • ${selectedRate}`;
    summaryText.textContent=text;
    // Facebook share/profile URLs don't reliably accept prefilled message text.
    // The session summary is shown clearly here for the client to copy when messaging.
    bookButton.href=FACEBOOK_URL;
    bookButton.classList.remove("disabled");
  } else {
    summaryText.textContent="Select a date, time, and coaching type.";
    bookButton.href="#"; bookButton.classList.add("disabled");
  }
}

document.getElementById("prevMonth").onclick=()=>{view.setMonth(view.getMonth()-1);renderCalendar();};
document.getElementById("nextMonth").onclick=()=>{view.setMonth(view.getMonth()+1);renderCalendar();};
renderCalendar(); renderSlots();