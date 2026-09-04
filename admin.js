const SUPABASE_URL="https://bnekbuwfloagqjzselxp.supabase.co",SUPABASE_PUBLISHABLE_KEY="sb_publishable_Xs8qdDm4RTa2Adjw34SLKw_rS-c-ikB";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id),loginView=$("loginView"),adminView=$("adminView"),adminDate=$("adminDate"),slotList=$("slotList"),bookingGroups=$("bookingGroups"),editDialog=$("editDialog");
let rowsByHour=new Map(),bookingsForDay=[];
const pad=n=>String(n).padStart(2,"0"),dateStr=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,todayStr=()=>dateStr(new Date()),hourName=h=>h===24?"12:00 MN":`${h%12||12}:00 ${h<12?"AM":"PM"}`,hourLabel=h=>`${hourName(h)} – ${hourName(h+1)}`,peso=n=>"₱"+Number(n||0).toLocaleString("en-PH",{maximumFractionDigits:2});
const standardRate=n=>n===1?300:n===2?250:200;
const coachingType=n=>n===1?"1-on-1":n===2?"2 Players":"3–5 Players";
const dateRange=(a,b)=>{const out=[],d=new Date(a+"T00:00:00"),e=new Date(b+"T00:00:00");while(d<=e){out.push(dateStr(d));d.setDate(d.getDate()+1);}return out;};
function toast(s){const e=$("toast");e.textContent=s;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2200);}
function fillHours(sel,a,b){sel.innerHTML="";for(let h=a;h<=b;h++){const o=document.createElement("option");o.value=h;o.textContent=hourName(h);sel.appendChild(o);}}
fillHours($("blockStart"),8,23);fillHours($("blockEnd"),9,24);$("blockEnd").value="24";

async function authRefresh(){
 const {data:{session}}=await db.auth.getSession();
 if(session){loginView.classList.add("hidden");adminView.classList.remove("hidden");const t=todayStr();adminDate.value||=t;$("bookingDate").value||=t;$("blockFromDate").value||=t;$("blockToDate").value||=t;adminCalendarView=new Date();adminCalendarView.setDate(1);await Promise.all([loadDay(),loadBookingAvailability(),loadReports(),loadAdminCalendar()]);}
 else{adminView.classList.add("hidden");loginView.classList.remove("hidden");}
}
$("loginForm").onsubmit=async e=>{e.preventDefault();$("loginError").textContent="";const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)$("loginError").textContent=error.message;else authRefresh();};
$("logoutBtn").onclick=async()=>{await db.auth.signOut();authRefresh();};

async function fetchSlots(d){const {data,error}=await db.from("schedule_slots").select("id,slot_date,start_hour,status,client_name,contact,coaching_type,rate,notes,booking_id").eq("slot_date",d).order("start_hour");if(error)throw error;return data||[];}
async function fetchBookings(d){const {data,error}=await db.from("bookings").select("*").eq("session_date",d).neq("status","cancelled").order("start_hour");if(error)throw error;return data||[];}

async function loadDay(){
 if(!adminDate.value)return;slotList.innerHTML='<div class="empty">Loading…</div>';bookingGroups.innerHTML='<div class="empty">Loading…</div>';
 try{const [slots,books]=await Promise.all([fetchSlots(adminDate.value),fetchBookings(adminDate.value)]);rowsByHour=new Map(slots.map(r=>[Number(r.start_hour),r]));bookingsForDay=books;renderSlots();renderBookingGroups();}catch(e){slotList.innerHTML=`<div class="empty">${e.message}</div>`;}
}
adminDate.onchange=async()=>{await loadDay();await loadAdminCalendar();};
function renderSlots(){
 slotList.innerHTML="";let c={available:0,booked:0,unavailable:0};
 for(let h=8;h<24;h++){const r=rowsByHour.get(h)||{status:"available"};c[r.status]++;const div=document.createElement("div");div.className="admin-slot";const label=r.status==="booked"?(r.client_name||"Booked session"):r.status==="unavailable"?"Blocked time":"Open";div.innerHTML=`<div class="time">${hourLabel(h)}</div><span class="badge ${r.status}">${r.status}</span><div class="client-mini">${label}</div><button class="edit-btn">Edit</button>`;div.querySelector("button").onclick=()=>openEditor(h);slotList.appendChild(div);}
 $("availableCount").textContent=c.available;$("bookedCount").textContent=c.booked;$("unavailableCount").textContent=c.unavailable;
}
function renderBookingGroups(){
 bookingGroups.innerHTML="";
 if(!bookingsForDay.length){bookingGroups.innerHTML='<div class="empty">No grouped bookings on this date yet. Older v3 bookings may still appear only in Hourly View.</div>';return;}
 bookingsForDay.forEach(b=>{const card=document.createElement("article");card.className="booking-card";const balance=Math.max(0,Number(b.total_amount)-Number(b.amount_paid||0));card.innerHTML=`<div class="booking-card-top"><div><h4>${b.client_name}</h4><div class="meta">${hourName(b.start_hour)}–${hourName(b.end_hour)} • ${b.participant_count} player(s) • ${b.coaching_type||""}<br>${b.rate_mode==="custom"?"Custom":"Standard"} rate: ${peso(b.rate_per_person)}/person/hr${b.contact?` • ${b.contact}`:""}</div></div><div class="money">${peso(b.total_amount)}<small>Paid ${peso(b.amount_paid)} • Balance ${peso(balance)}</small></div></div><div class="booking-actions"><button class="pay-btn" data-act="pay">Update Payment</button><button class="cancel-btn" data-act="cancel">Cancel Whole Booking</button></div>`;card.querySelector('[data-act="pay"]').onclick=()=>updatePayment(b);card.querySelector('[data-act="cancel"]').onclick=()=>cancelBooking(b);bookingGroups.appendChild(card);});
}
async function cancelBooking(b){
 if(!confirm(`Cancel the whole booking for ${b.client_name} (${hourName(b.start_hour)}–${hourName(b.end_hour)})? All its hours will become available again.`))return;
 const {error:e1}=await db.from("bookings").update({status:"cancelled",cancelled_at:new Date().toISOString()}).eq("id",b.id);if(e1)return alert(e1.message);
 const {error:e2}=await db.from("schedule_slots").delete().eq("booking_id",b.id);if(e2)return alert(e2.message);
 toast("Whole booking cancelled");await Promise.all([loadDay(),loadBookingAvailability(),loadReports(),loadAdminCalendar()]);
}
async function updatePayment(b){
 const raw=prompt(`Amount received for ${b.client_name}\nTotal: ${peso(b.total_amount)}`,String(b.amount_paid||0));if(raw===null)return;const v=Number(raw);if(Number.isNaN(v)||v<0)return alert("Enter a valid amount.");
 const {error}=await db.from("bookings").update({amount_paid:v}).eq("id",b.id);if(error)return alert(error.message);toast("Payment updated");await Promise.all([loadDay(),loadReports()]);
}

async function loadBookingAvailability(){
 const d=$("bookingDate").value;if(!d)return;const slots=await fetchSlots(d),map=new Map(slots.map(r=>[Number(r.start_hour),r.status]));const start=$("bookingStart"),end=$("bookingEnd");start.innerHTML="";
 for(let h=8;h<24;h++)if((map.get(h)||"available")==="available"){const o=document.createElement("option");o.value=h;o.textContent=hourName(h);start.appendChild(o);}
 if(!start.options.length){$("bookingHint").textContent="No available starting time on this date.";end.innerHTML="";return;}populateEnd(map);updateTotal();
}
$("bookingDate").onchange=loadBookingAvailability;$("bookingStart").onchange=async()=>{const slots=await fetchSlots($("bookingDate").value),map=new Map(slots.map(r=>[Number(r.start_hour),r.status]));populateEnd(map);updateTotal();};$("bookingEnd").onchange=updateTotal;
function populateEnd(map){const s=Number($("bookingStart").value),end=$("bookingEnd");end.innerHTML="";for(let e=s+1;e<=24;e++){let ok=true;for(let h=s;h<e;h++)if((map.get(h)||"available")!=="available"){ok=false;break;}if(!ok)break;const o=document.createElement("option");o.value=e;o.textContent=hourName(e);end.appendChild(o);}$("bookingHint").textContent=`Available consecutive time from ${hourName(s)}.`;}
function updateRate(){const n=Number($("participantCount").value);if($("rateMode").value==="standard"){$("ratePerPerson").value=standardRate(n);$("ratePerPerson").readOnly=true;}else $("ratePerPerson").readOnly=false;updateTotal();}
$("participantCount").onchange=updateRate;$("rateMode").onchange=updateRate;$("ratePerPerson").oninput=updateTotal;
function updateTotal(){const s=Number($("bookingStart").value||8),e=Number($("bookingEnd").value||s+1),hrs=Math.max(1,e-s),n=Number($("participantCount").value||1),r=Number($("ratePerPerson").value||0),t=hrs*n*r;$("bookingTotal").textContent=peso(t);$("bookingCalc").textContent=`${hrs} hr × ${n} player(s) × ${peso(r)}`;}
updateRate();

$("quickBookingForm").onsubmit=async e=>{
 e.preventDefault();const d=$("bookingDate").value,s=Number($("bookingStart").value),en=Number($("bookingEnd").value),n=Number($("participantCount").value),r=Number($("ratePerPerson").value),paid=Number($("amountPaid").value||0),total=(en-s)*n*r;
 if(!d||!s||!en||en<=s)return alert("Choose a valid date/time range.");
 const current=await fetchSlots(d),map=new Map(current.map(x=>[Number(x.start_hour),x.status]));for(let h=s;h<en;h++)if((map.get(h)||"available")!=="available")return alert(`${hourLabel(h)} is no longer available.`);
 const book={session_date:d,start_hour:s,end_hour:en,client_name:$("bookingClient").value.trim(),contact:$("bookingContact").value.trim()||null,participant_count:n,coaching_type:coachingType(n),rate_mode:$("rateMode").value,rate_per_person:r,total_amount:total,amount_paid:paid,notes:$("bookingNotes").value.trim()||null,status:"confirmed"};
 const {data:b,error:e1}=await db.from("bookings").insert(book).select().single();if(e1)return alert(e1.message);
 const rows=[];for(let h=s;h<en;h++)rows.push({slot_date:d,start_hour:h,status:"booked",client_name:book.client_name,contact:book.contact,coaching_type:book.coaching_type,rate:r,notes:book.notes,booking_id:b.id});
 const {error:e2}=await db.from("schedule_slots").insert(rows);if(e2){await db.from("bookings").delete().eq("id",b.id);return alert(e2.message);}
 toast("Booking saved");adminDate.value=d;$("bookingClient").value="";$("bookingContact").value="";$("bookingNotes").value="";$("amountPaid").value="0";await Promise.all([loadDay(),loadBookingAvailability(),loadReports(),loadAdminCalendar()]);
};

document.querySelectorAll("[data-preset]").forEach(b=>b.onclick=()=>{const p=b.dataset.preset,m={whole:[8,24],morning:[8,12],afternoon:[12,17],evening:[17,24]}[p];$("blockStart").value=m[0];$("blockEnd").value=m[1];});
$("blockFromDate").onchange=()=>{if(!$("blockToDate").value||$("blockToDate").value<$("blockFromDate").value)$("blockToDate").value=$("blockFromDate").value;};
$("blockForm").onsubmit=async e=>{e.preventDefault();const a=$("blockFromDate").value,b=$("blockToDate").value,s=Number($("blockStart").value),en=Number($("blockEnd").value);if(!a||!b||b<a||en<=s)return alert("Check the range.");const rows=[];for(const d of dateRange(a,b)){const slots=await fetchSlots(d),map=new Map(slots.map(x=>[Number(x.start_hour),x.status]));for(let h=s;h<en;h++)if((map.get(h)||"available")==="available")rows.push({slot_date:d,start_hour:h,status:"unavailable"});}if(!rows.length)return alert("Nothing to block.");const {error}=await db.from("schedule_slots").upsert(rows,{onConflict:"slot_date,start_hour"});if(error)return alert(error.message);toast("Unavailable schedule saved");await Promise.all([loadDay(),loadBookingAvailability(),loadAdminCalendar()]);};
$("clearUnavailableBtn").onclick=async()=>{const a=$("blockFromDate").value,b=$("blockToDate").value,s=Number($("blockStart").value),en=Number($("blockEnd").value);if(!confirm("Clear unavailable slots in this range? Bookings will stay booked."))return;const {error}=await db.from("schedule_slots").delete().eq("status","unavailable").gte("slot_date",a).lte("slot_date",b).gte("start_hour",s).lt("start_hour",en);if(error)return alert(error.message);toast("Unavailable slots cleared");await Promise.all([loadDay(),loadBookingAvailability(),loadAdminCalendar()]);};

async function loadReports(){
 const {data,error}=await db.from("bookings").select("session_date,total_amount,amount_paid,status");if(error)return;
 const active=(data||[]).filter(x=>x.status!=="cancelled"),today=new Date(),t=todayStr(),weekStart=new Date(today);weekStart.setDate(today.getDate()-((today.getDay()+6)%7));const weekEnd=new Date(weekStart);weekEnd.setDate(weekStart.getDate()+6);const ms=new Date(today.getFullYear(),today.getMonth(),1),me=new Date(today.getFullYear(),today.getMonth()+1,0);
 const calc=(arr,prefix)=>{const gross=arr.reduce((a,x)=>a+Number(x.total_amount||0),0),paid=arr.reduce((a,x)=>a+Number(x.amount_paid||0),0);$(prefix+"Gross").textContent=peso(gross);$(prefix+"Meta").textContent=`${arr.length} session(s) • ${peso(paid)} collected`;}
 calc(active.filter(x=>x.session_date===t),"today");
 calc(active.filter(x=>x.session_date>=dateStr(weekStart)&&x.session_date<=dateStr(weekEnd)),"week");
 calc(active.filter(x=>x.session_date>=dateStr(ms)&&x.session_date<=dateStr(me)),"month");
 calc(active,"all");
}

function openEditor(h){const r=rowsByHour.get(h)||{status:"available"};$("editHour").value=h;$("editSlotTitle").textContent=hourLabel(h);$("editStatus").value=r.status;$("clientName").value=r.client_name||"";$("contact").value=r.contact||"";$("coachingType").value=r.coaching_type||"";$("rate").value=r.rate??"";$("notes").value=r.notes||"";toggleClientFields();editDialog.showModal();}
$("editStatus").onchange=toggleClientFields;function toggleClientFields(){$("clientFields").style.opacity=$("editStatus").value==="booked"?"1":".45";}$("closeDialog").onclick=()=>editDialog.close();
$("editForm").onsubmit=async e=>{e.preventDefault();const h=Number($("editHour").value),st=$("editStatus").value,existing=rowsByHour.get(h);if(st==="available"){if(existing?.id)await db.from("schedule_slots").delete().eq("id",existing.id);}else{const p={slot_date:adminDate.value,start_hour:h,status:st,client_name:st==="booked"?$("clientName").value.trim()||null:null,contact:st==="booked"?$("contact").value.trim()||null:null,coaching_type:st==="booked"?$("coachingType").value.trim()||null:null,rate:st==="booked"?Number($("rate").value)||null:null,notes:st==="booked"?$("notes").value.trim()||null:null,booking_id:existing?.booking_id||null};const {error}=await db.from("schedule_slots").upsert(p,{onConflict:"slot_date,start_hour"});if(error)return alert(error.message);}editDialog.close();toast("Hour updated");await Promise.all([loadDay(),loadBookingAvailability(),loadAdminCalendar()]);};
$("deleteBtn").onclick=async()=>{const h=Number($("editHour").value),existing=rowsByHour.get(h);if(existing?.id)await db.from("schedule_slots").delete().eq("id",existing.id);editDialog.close();toast("Hour reset");await Promise.all([loadDay(),loadBookingAvailability(),loadAdminCalendar()]);};

const adminCalendarEl=$("adminCalendar"),adminMonthLabel=$("adminMonthLabel");
let adminCalendarView=new Date();adminCalendarView.setDate(1);

function adminDayState(map,date){
  let booked=0,unavailable=0,available=0;
  for(let h=8;h<24;h++){
    const s=map.get(`${date}|${h}`)||"available";
    if(s==="booked")booked++;
    else if(s==="unavailable")unavailable++;
    else available++;
  }
  if(booked===16)return{cls:"full-booked",label:"Fully booked"};
  if(available===0)return{cls:"full-unavailable",label:"No availability"};
  if(booked>0)return{cls:"partial-booked",label:`${booked} booked`};
  if(unavailable>0)return{cls:"partial-unavailable",label:"Limited"};
  return{cls:"",label:"Open"};
}

async function loadAdminCalendar(){
  const y=adminCalendarView.getFullYear(),m=adminCalendarView.getMonth();
  adminMonthLabel.textContent=adminCalendarView.toLocaleDateString("en-PH",{month:"long",year:"numeric"});
  const last=new Date(y,m+1,0);
  const start=`${y}-${pad(m+1)}-01`,end=`${y}-${pad(m+1)}-${pad(last.getDate())}`;
  const {data,error}=await db.from("schedule_slots").select("slot_date,start_hour,status").gte("slot_date",start).lte("slot_date",end);
  const map=new Map();
  if(!error)(data||[]).forEach(r=>map.set(`${r.slot_date}|${Number(r.start_hour)}`,r.status));

  adminCalendarEl.innerHTML="";
  const first=new Date(y,m,1).getDay(),today=new Date();today.setHours(0,0,0,0);
  for(let i=0;i<first;i++){const blank=document.createElement("span");blank.className="admin-day blank";adminCalendarEl.appendChild(blank);}
  for(let d=1;d<=last.getDate();d++){
    const dt=new Date(y,m,d),ds=`${y}-${pad(m+1)}-${pad(d)}`,state=adminDayState(map,ds);
    const btn=document.createElement("button");btn.type="button";btn.className="admin-day";
    if(state.cls)btn.classList.add(state.cls);
    if(dt.getTime()===today.getTime())btn.classList.add("today");
    if(adminDate.value===ds)btn.classList.add("selected");
    btn.innerHTML=`<span class="day-num">${d}</span><span class="day-info">${state.label}</span>`;
    btn.onclick=async()=>{adminDate.value=ds;await loadDay();await loadAdminCalendar();document.querySelector(".day-section")?.scrollIntoView({behavior:"smooth",block:"start"});};
    adminCalendarEl.appendChild(btn);
  }
}
$("adminPrevMonth").onclick=()=>{adminCalendarView.setMonth(adminCalendarView.getMonth()-1);loadAdminCalendar();};
$("adminNextMonth").onclick=()=>{adminCalendarView.setMonth(adminCalendarView.getMonth()+1);loadAdminCalendar();};

authRefresh();