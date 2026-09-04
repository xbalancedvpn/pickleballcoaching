const SUPABASE_URL = "https://bnekbuwfloagqjzselxp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Xs8qdDm4RTa2Adjw34SLKw_rS-c-ikB";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const adminDate = document.getElementById("adminDate");
const slotList = document.getElementById("slotList");
const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const clientFields = document.getElementById("clientFields");
const bookingDate = document.getElementById("bookingDate");
const bookingStart = document.getElementById("bookingStart");
const bookingEnd = document.getElementById("bookingEnd");
const blockFromDate = document.getElementById("blockFromDate");
const blockToDate = document.getElementById("blockToDate");
const blockStart = document.getElementById("blockStart");
const blockEnd = document.getElementById("blockEnd");
let rowsByHour = new Map();

const pad = n => String(n).padStart(2,"0");
const localDateString = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayStr = () => localDateString(new Date());
const hourName = h => h === 24 ? "12:00 MN" : `${h%12 || 12}:00 ${h<12 ? "AM" : "PM"}`;
const hourLabel = h => `${hourName(h)} - ${hourName(h+1)}`;
const dateRange = (from,to) => {
  const out=[], d=new Date(from+"T00:00:00"), end=new Date(to+"T00:00:00");
  while(d<=end){ out.push(localDateString(d)); d.setDate(d.getDate()+1); }
  return out;
};

function toast(msg){
  const el=document.getElementById("toast");
  el.textContent=msg; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2200);
}
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
function fillHourSelect(select,start,end){
  select.innerHTML="";
  for(let h=start; h<=end; h++){
    const o=document.createElement("option"); o.value=h; o.textContent=hourName(h); select.appendChild(o);
  }
}
fillHourSelect(blockStart,8,23);
fillHourSelect(blockEnd,9,24);
blockEnd.value="24";

async function refreshAuth(){
  const {data:{session}}=await db.auth.getSession();
  if(session){
    loginView.classList.add("hidden"); adminView.classList.remove("hidden");
    adminDate.value ||= todayStr(); bookingDate.value ||= todayStr();
    blockFromDate.value ||= todayStr(); blockToDate.value ||= todayStr();
    await loadDate(); await loadBookingAvailability();
  }else{
    adminView.classList.add("hidden"); loginView.classList.remove("hidden");
  }
}

loginForm.addEventListener("submit", async e => {
  e.preventDefault(); loginError.textContent="";
  const {error}=await db.auth.signInWithPassword({
    email:document.getElementById("email").value.trim(),
    password:document.getElementById("password").value
  });
  if(error) loginError.textContent=error.message; else refreshAuth();
});
document.getElementById("logoutBtn").onclick=async()=>{ await db.auth.signOut(); refreshAuth(); };

async function fetchRowsForDate(date){
  const {data,error}=await db.from("schedule_slots")
    .select("id,slot_date,start_hour,status,client_name,contact,coaching_type,rate,notes")
    .eq("slot_date",date).order("start_hour");
  if(error) throw error;
  return data || [];
}

async function loadDate(){
  if(!adminDate.value) return;
  slotList.innerHTML='<div style="padding:20px;color:#68736c">Loading schedule...</div>';
  try{
    const data=await fetchRowsForDate(adminDate.value);
    rowsByHour=new Map(data.map(r=>[Number(r.start_hour),r]));
    renderRows();
  }catch(e){
    slotList.innerHTML=`<div style="padding:20px;color:#a34842">${escapeHtml(e.message)}</div>`;
  }
}
adminDate.onchange=loadDate;

function renderRows(){
  slotList.innerHTML="";
  const counts={available:0,booked:0,unavailable:0};
  for(let h=8; h<24; h++){
    const r=rowsByHour.get(h)||{status:"available"}; counts[r.status]++;
    const client=r.status==="booked" ? (r.client_name||r.coaching_type||"Booked session") : (r.status==="unavailable"?"Blocked time":"Open for booking");
    const div=document.createElement("div"); div.className="admin-slot";
    div.innerHTML=`<div class="time">${hourLabel(h)}</div><span class="badge ${r.status}">${r.status}</span><div class="client-mini">${escapeHtml(client)}</div><button class="edit-btn">Edit</button>`;
    div.querySelector(".edit-btn").onclick=()=>openEditor(h); slotList.appendChild(div);
  }
  document.getElementById("availableCount").textContent=counts.available;
  document.getElementById("bookedCount").textContent=counts.booked;
  document.getElementById("unavailableCount").textContent=counts.unavailable;
}

async function loadBookingAvailability(){
  if(!bookingDate.value) return;
  try{
    const data=await fetchRowsForDate(bookingDate.value);
    const map=new Map(data.map(r=>[Number(r.start_hour),r.status]));
    bookingStart.innerHTML="";
    for(let h=8; h<24; h++){
      if((map.get(h)||"available")==="available"){
        const o=document.createElement("option"); o.value=h; o.textContent=hourName(h); bookingStart.appendChild(o);
      }
    }
    if(!bookingStart.options.length){
      document.getElementById("bookingHint").textContent="No available starting time on this date.";
      bookingEnd.innerHTML=""; return;
    }
    populateBookingEnd(map);
  }catch(e){ document.getElementById("bookingHint").textContent=e.message; }
}
bookingDate.onchange=loadBookingAvailability;
bookingStart.onchange=async()=>{
  const data=await fetchRowsForDate(bookingDate.value);
  populateBookingEnd(new Map(data.map(r=>[Number(r.start_hour),r.status])));
};
function populateBookingEnd(map){
  const start=Number(bookingStart.value); bookingEnd.innerHTML="";
  for(let end=start+1; end<=24; end++){
    let okay=true;
    for(let h=start; h<end; h++) if((map.get(h)||"available")!=="available"){ okay=false; break; }
    if(!okay) break;
    const o=document.createElement("option"); o.value=end; o.textContent=hourName(end); bookingEnd.appendChild(o);
  }
  document.getElementById("bookingHint").textContent=`Available consecutive time from ${hourName(start)}.`;
}

document.getElementById("quickBookingForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const date=bookingDate.value, start=Number(bookingStart.value), end=Number(bookingEnd.value);
  if(!date || Number.isNaN(start) || Number.isNaN(end) || end<=start) return alert("Choose a valid time range.");
  const current=await fetchRowsForDate(date), map=new Map(current.map(r=>[Number(r.start_hour),r.status]));
  for(let h=start; h<end; h++) if((map.get(h)||"available")!=="available") return alert(`${hourLabel(h)} is no longer available.`);
  const client=document.getElementById("bookingClient").value.trim();
  const contact=document.getElementById("bookingContact").value.trim()||null;
  const type=document.getElementById("bookingType").value||null;
  const rate=Number(document.getElementById("bookingRate").value)||null;
  const notes=document.getElementById("bookingNotes").value.trim()||null;
  const rows=[];
  for(let h=start; h<end; h++) rows.push({slot_date:date,start_hour:h,status:"booked",client_name:client,contact,coaching_type:type,rate,notes});
  const {error}=await db.from("schedule_slots").upsert(rows,{onConflict:"slot_date,start_hour"});
  if(error) return alert(error.message);
  toast(`Booked ${hourName(start)} - ${hourName(end)}`);
  adminDate.value=date; await loadDate(); await loadBookingAvailability();
  document.getElementById("bookingClient").value=""; document.getElementById("bookingContact").value=""; document.getElementById("bookingNotes").value="";
});

document.getElementById("wholeDayBtn").onclick=()=>{ blockStart.value="8"; blockEnd.value="24"; };
document.getElementById("sameDateBtn").onclick=()=>{ blockToDate.value=blockFromDate.value; };
blockFromDate.onchange=()=>{ if(!blockToDate.value || blockToDate.value<blockFromDate.value) blockToDate.value=blockFromDate.value; };

document.getElementById("blockForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const from=blockFromDate.value, to=blockToDate.value, start=Number(blockStart.value), end=Number(blockEnd.value);
  if(!from || !to || to<from || end<=start) return alert("Check the date/time range.");
  const rows=[];
  for(const date of dateRange(from,to)){
    const existing=await fetchRowsForDate(date), map=new Map(existing.map(r=>[Number(r.start_hour),r.status]));
    for(let h=start; h<end; h++){
      if((map.get(h)||"available")==="available") rows.push({slot_date:date,start_hour:h,status:"unavailable",client_name:null,contact:null,coaching_type:null,rate:null,notes:null});
    }
  }
  if(!rows.length) return alert("Nothing to block. These hours may already be booked or unavailable.");
  const {error}=await db.from("schedule_slots").upsert(rows,{onConflict:"slot_date,start_hour"});
  if(error) return alert(error.message);
  toast(`${rows.length} hour slot(s) marked unavailable`);
  if(adminDate.value>=from && adminDate.value<=to) await loadDate();
  if(bookingDate.value>=from && bookingDate.value<=to) await loadBookingAvailability();
});

document.getElementById("clearUnavailableBtn").onclick=async()=>{
  const from=blockFromDate.value, to=blockToDate.value, start=Number(blockStart.value), end=Number(blockEnd.value);
  if(!from || !to || to<from || end<=start) return alert("Check the date/time range.");
  if(!confirm("Clear UNAVAILABLE slots in this range? Existing bookings will stay booked.")) return;
  const {error}=await db.from("schedule_slots").delete().eq("status","unavailable").gte("slot_date",from).lte("slot_date",to).gte("start_hour",start).lt("start_hour",end);
  if(error) return alert(error.message);
  toast("Unavailable slots cleared"); await loadDate(); await loadBookingAvailability();
};

function openEditor(hour){
  const r=rowsByHour.get(hour)||{status:"available",client_name:"",contact:"",coaching_type:"",rate:"",notes:""};
  document.getElementById("editHour").value=hour; document.getElementById("editSlotTitle").textContent=hourLabel(hour);
  document.getElementById("editStatus").value=r.status; document.getElementById("clientName").value=r.client_name||"";
  document.getElementById("contact").value=r.contact||""; document.getElementById("coachingType").value=r.coaching_type||"";
  document.getElementById("rate").value=r.rate??""; document.getElementById("notes").value=r.notes||"";
  toggleClientFields(); editDialog.showModal();
}
document.getElementById("editStatus").onchange=toggleClientFields;
function toggleClientFields(){
  const booked=document.getElementById("editStatus").value==="booked";
  clientFields.style.opacity=booked?"1":".45"; clientFields.style.pointerEvents=booked?"auto":"none";
}
document.getElementById("closeDialog").onclick=()=>editDialog.close();
editForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const hour=Number(document.getElementById("editHour").value), status=document.getElementById("editStatus").value, booked=status==="booked";
  if(status==="available"){
    const existing=rowsByHour.get(hour);
    if(existing?.id){ const {error}=await db.from("schedule_slots").delete().eq("id",existing.id); if(error) return alert(error.message); }
  }else{
    const payload={slot_date:adminDate.value,start_hour:hour,status,
      client_name:booked?(document.getElementById("clientName").value.trim()||null):null,
      contact:booked?(document.getElementById("contact").value.trim()||null):null,
      coaching_type:booked?(document.getElementById("coachingType").value||null):null,
      rate:booked?(Number(document.getElementById("rate").value)||null):null,
      notes:booked?(document.getElementById("notes").value.trim()||null):null};
    const {error}=await db.from("schedule_slots").upsert(payload,{onConflict:"slot_date,start_hour"}); if(error) return alert(error.message);
  }
  editDialog.close(); toast("Schedule updated"); await loadDate();
  if(bookingDate.value===adminDate.value) await loadBookingAvailability();
});
document.getElementById("deleteBtn").onclick=async()=>{
  const hour=Number(document.getElementById("editHour").value), existing=rowsByHour.get(hour);
  if(existing?.id){ const {error}=await db.from("schedule_slots").delete().eq("id",existing.id); if(error) return alert(error.message); }
  editDialog.close(); toast("Slot reset to Available"); await loadDate();
  if(bookingDate.value===adminDate.value) await loadBookingAvailability();
};

refreshAuth();
