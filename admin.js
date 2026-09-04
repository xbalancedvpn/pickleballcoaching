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
let rowsByHour = new Map();

const pad = n => String(n).padStart(2,"0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const hourLabel = h => {
  const f = x => x === 24 ? "12:00 MN" : `${x%12 || 12}:00 ${x<12 ? "AM" : "PM"}`;
  return `${f(h)} – ${f(h+1)}`;
};

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

async function refreshAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    loginView.classList.add("hidden");
    adminView.classList.remove("hidden");
    if (!adminDate.value) adminDate.value = todayStr();
    loadDate();
  } else {
    adminView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
}

loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) loginError.textContent = error.message;
  else refreshAuth();
});

document.getElementById("logoutBtn").onclick = async () => {
  await db.auth.signOut();
  refreshAuth();
};
adminDate.onchange = loadDate;

async function loadDate() {
  if (!adminDate.value) return;
  slotList.innerHTML = '<div style="padding:20px;color:#68736c">Loading schedule…</div>';
  const { data, error } = await db.from("schedule_slots")
    .select("id,slot_date,start_hour,status,client_name,contact,coaching_type,rate,notes")
    .eq("slot_date", adminDate.value)
    .order("start_hour");

  if (error) {
    slotList.innerHTML = `<div style="padding:20px;color:#a34842">${escapeHtml(error.message)}</div>`;
    return;
  }
  rowsByHour = new Map((data || []).map(r => [Number(r.start_hour), r]));
  renderRows();
}

function renderRows() {
  slotList.innerHTML = "";
  const counts = {available:0,booked:0,unavailable:0};
  for (let h=8; h<24; h++) {
    const r = rowsByHour.get(h) || {status:"available"};
    counts[r.status] = (counts[r.status] || 0) + 1;
    const div = document.createElement("div");
    div.className = "admin-slot";
    const client = r.status === "booked"
      ? (r.client_name || r.coaching_type || "Booked session")
      : (r.status === "unavailable" ? "Blocked time" : "Open for booking");
    div.innerHTML = `<div class="time">${hourLabel(h)}</div>
      <span class="badge ${r.status}">${r.status}</span>
      <div class="client-mini">${escapeHtml(client)}</div>
      <button class="edit-btn" data-hour="${h}">Edit</button>`;
    div.querySelector(".edit-btn").onclick = () => openEditor(h);
    slotList.appendChild(div);
  }
  document.getElementById("availableCount").textContent = counts.available;
  document.getElementById("bookedCount").textContent = counts.booked;
  document.getElementById("unavailableCount").textContent = counts.unavailable;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function openEditor(hour) {
  const r = rowsByHour.get(hour) || {status:"available",client_name:"",contact:"",coaching_type:"",rate:"",notes:""};
  document.getElementById("editHour").value = hour;
  document.getElementById("editSlotTitle").textContent = hourLabel(hour);
  document.getElementById("editStatus").value = r.status;
  document.getElementById("clientName").value = r.client_name || "";
  document.getElementById("contact").value = r.contact || "";
  document.getElementById("coachingType").value = r.coaching_type || "";
  document.getElementById("rate").value = r.rate ?? "";
  document.getElementById("notes").value = r.notes || "";
  toggleClientFields();
  editDialog.showModal();
}

document.getElementById("editStatus").onchange = toggleClientFields;
function toggleClientFields() {
  const booked = document.getElementById("editStatus").value === "booked";
  clientFields.style.opacity = booked ? "1" : ".45";
  clientFields.style.pointerEvents = booked ? "auto" : "none";
}

document.getElementById("closeDialog").onclick = () => editDialog.close();

editForm.addEventListener("submit", async e => {
  e.preventDefault();
  const hour = Number(document.getElementById("editHour").value);
  const status = document.getElementById("editStatus").value;
  const booked = status === "booked";
  const payload = {
    slot_date: adminDate.value,
    start_hour: hour,
    status,
    client_name: booked ? (document.getElementById("clientName").value.trim() || null) : null,
    contact: booked ? (document.getElementById("contact").value.trim() || null) : null,
    coaching_type: booked ? (document.getElementById("coachingType").value || null) : null,
    rate: booked ? (Number(document.getElementById("rate").value) || null) : null,
    notes: booked ? (document.getElementById("notes").value.trim() || null) : null
  };

  const { error } = await db.from("schedule_slots").upsert(payload, {onConflict:"slot_date,start_hour"});
  if (error) {
    alert(error.message);
    return;
  }
  editDialog.close();
  toast("Schedule updated");
  loadDate();
});

document.getElementById("deleteBtn").onclick = async () => {
  const hour = Number(document.getElementById("editHour").value);
  const existing = rowsByHour.get(hour);
  if (existing?.id) {
    const { error } = await db.from("schedule_slots").delete().eq("id", existing.id);
    if (error) {
      alert(error.message);
      return;
    }
  }
  editDialog.close();
  toast("Slot reset to Available");
  loadDate();
};

refreshAuth();
