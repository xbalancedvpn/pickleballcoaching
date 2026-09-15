// Pickyla v17-G operations polish
(function(){
  const $g=id=>document.getElementById(id),admin=$g('adminView');if(!admin)return;
  const safeCall=async name=>{try{const fn=window[name];if(typeof fn==='function')await fn();}catch(e){console.warn(`v17-G ${name}:`,e);}};
  const jump=id=>{document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});};

  // Quick action bar: keeps the most-used admin actions one tap away.
  const welcome=$g('adminDashboardTop');
  const quick=document.createElement('div');quick.className='v17g-quickbar';quick.innerHTML=`<div class="v17g-quick-actions">
    <button type="button" class="primary" data-jump="todayCommandSection">Today</button>
    <button type="button" data-jump="quickBookingForm">+ New Booking</button>
    <button type="button" data-jump="inquirySection">Inquiries</button>
    <button type="button" data-jump="clientHubSection">Clients</button>
    <button type="button" data-jump="programHubSection">Programs</button>
    <button type="button" data-jump="adminReportsSection">Reports</button>
  </div><div><span id="v17gFreshness" class="v17g-freshness">Live data</span> <button id="v17gRefresh" type="button" class="v17g-refresh">↻ Refresh</button></div>`;
  welcome?.insertAdjacentElement('afterend',quick);quick.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.jump));

  async function refreshOperationalViews(){
    const btn=$g('v17gRefresh');if(btn){btn.disabled=true;btn.textContent='Refreshing…';}
    await Promise.allSettled(['loadTodayCommandCenter','loadCollectionAlerts','loadPaymentDashboard','loadReports','loadInquiries','loadV17Clients','loadV17Programs','loadAdminCalendar','loadDay'].map(safeCall));
    const f=$g('v17gFreshness');if(f)f.textContent=`Updated ${new Date().toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'})}`;
    if(btn){btn.disabled=false;btn.textContent='↻ Refresh';}
    syncActionStrip();applyTodayFilter();
  }
  $g('v17gRefresh').onclick=refreshOperationalViews;

  // Compact operational health strip.
  const strip=document.createElement('div');strip.className='v17g-action-strip';strip.innerHTML=`
    <button class="v17g-action-card" data-kind="pending" data-target="inquirySection"><span>Pending inquiries</span><strong>0</strong></button>
    <button class="v17g-action-card" data-kind="alerts" data-target="todayCommandSection"><span>All admin actions</span><strong>0</strong></button>
    <button class="v17g-action-card" data-kind="collection" data-target="collectionAlertSection"><span>Collection alerts</span><strong>0</strong></button>
    <button class="v17g-action-card" data-kind="cancelled" data-target="daySection"><span>Cancelled</span><strong>0</strong></button>`;
  quick.insertAdjacentElement('afterend',strip);strip.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>jump(b.dataset.target));
  function ntext(id){return Number(String($g(id)?.textContent||'0').replace(/[^0-9]/g,''))||0;}
  function syncActionStrip(){
    const vals={pending:ntext('pendingCount'),alerts:ntext('adminNotificationCount'),collection:ntext('collectionDueCount'),cancelled:ntext('cancelCount')};
    Object.entries(vals).forEach(([k,v])=>{const el=strip.querySelector(`[data-kind="${k}"]`);if(!el)return;el.querySelector('strong').textContent=v;el.classList.toggle('attention',v>0&&k!=='cancelled');el.classList.toggle('danger',v>0&&k==='collection');});
    const dockAlert=document.querySelector('.v17g-mobile-dock .alert');if(dockAlert)dockAlert.dataset.count=String(vals.alerts);
  }
  ['pendingCount','adminNotificationCount','collectionDueCount','cancelCount'].forEach(id=>{const el=$g(id);if(el)new MutationObserver(syncActionStrip).observe(el,{childList:true,characterData:true,subtree:true});});

  // Today filters reduce scanning when the day gets busy.
  const todayList=$g('todaySessionList');let todayFilter='all';
  if(todayList){
    const tools=document.createElement('div');tools.className='v17g-today-tools';tools.innerHTML=`<div class="v17g-filter-chips">
      <button type="button" class="active" data-filter="all">All</button><button type="button" data-filter="action">Needs Action</button><button type="button" data-filter="upcoming">Upcoming</button><button type="button" data-filter="completed">Completed</button><button type="button" data-filter="outstanding">Outstanding</button>
    </div><span id="v17gTodayCount" class="v17g-today-count"></span>`;
    todayList.insertAdjacentElement('beforebegin',tools);
    tools.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{todayFilter=b.dataset.filter;tools.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));applyTodayFilter();});
    new MutationObserver(()=>setTimeout(applyTodayFilter,0)).observe(todayList,{childList:true,subtree:true});
  }
  function classifyToday(el){const t=el.textContent.toLowerCase();return{action:t.includes('needs closing')||t.includes('balance ₱')||t.includes('balance p'),upcoming:t.includes('scheduled')&&!t.includes('needs closing'),completed:t.includes('completed'),outstanding:(t.includes('balance ₱')||t.includes('balance p'))&&!t.includes('balance ₱0')&&!t.includes('balance p0')};}
  function applyTodayFilter(){if(!todayList)return;const items=[...todayList.querySelectorAll('.today-session-item')];let shown=0;items.forEach(el=>{const c=classifyToday(el),ok=todayFilter==='all'||Boolean(c[todayFilter]);el.classList.toggle('v17g-filtered',!ok);if(ok)shown++;});const label=$g('v17gTodayCount');if(label)label.textContent=`${shown} shown`;}

  // Client cleanup: permanently delete empty profiles, archive profiles that already have history.
  async function clientUsage(clientId){
    const results=await Promise.all([
      db.from('booking_participants').select('booking_id',{count:'exact',head:true}).eq('client_id',clientId),
      db.from('bookings').select('id',{count:'exact',head:true}).eq('client_id',clientId),
      db.from('client_programs').select('id',{count:'exact',head:true}).eq('client_id',clientId),
      db.from('progress_assessments').select('id',{count:'exact',head:true}).eq('client_id',clientId)
    ]);
    const failed=results.find(r=>r.error);if(failed)throw failed.error;
    return{participantLinks:Number(results[0].count||0),primaryBookings:Number(results[1].count||0),programs:Number(results[2].count||0),assessments:Number(results[3].count||0)};
  }
  function closeClientProfile(){
    $g('clientDetailSection')?.classList.add('hidden');
    try{v17SelectedClient=null;}catch(_e){}
  }
  async function removeClientProfile(client){
    if(!client?.id)return;
    let usage;try{usage=await clientUsage(client.id);}catch(e){return alert(`Could not check client history.\n\n${e.message||e}`);}
    const hasHistory=Object.values(usage).some(Number);
    if(hasHistory){
      const detail=[usage.primaryBookings?`${usage.primaryBookings} primary booking${usage.primaryBookings===1?'':'s'}`:'',usage.participantLinks?`${usage.participantLinks} booking participant link${usage.participantLinks===1?'':'s'}`:'',usage.programs?`${usage.programs} program enrollment${usage.programs===1?'':'s'}`:'',usage.assessments?`${usage.assessments} assessment${usage.assessments===1?'':'s'}`:''].filter(Boolean).join(', ');
      const ok=confirm(`${client.full_name} already has linked coaching history (${detail}).\n\nTo protect bookings, payments, programs and progress records, Pickyla will ARCHIVE this client instead of permanently deleting the profile. The client will disappear from the active client list.\n\nArchive this client?`);
      if(!ok)return;
      const {error}=await db.from('clients').update({is_active:false}).eq('id',client.id);if(error)return alert(error.message);
      closeClientProfile();toast('Client archived');await loadV17Clients();return;
    }
    const ok=confirm(`Permanently delete ${client.full_name}?\n\nNo linked bookings, programs or progress records were found. This action cannot be undone.`);if(!ok)return;
    const typed=prompt(`Type DELETE to permanently remove ${client.full_name}.`);if(typed!=='DELETE')return;
    const {error}=await db.from('clients').delete().eq('id',client.id);if(error)return alert(error.message);
    closeClientProfile();toast('Client permanently deleted');await loadV17Clients();
  }
  const oldRenderClients=(typeof renderV17Clients==='function')?renderV17Clients:null;
  if(oldRenderClients){
    renderV17Clients=function(){
      oldRenderClients();
      const q=String($g('clientSearch')?.value||'').trim().toLowerCase();
      const rows=(typeof v17Clients!=='undefined'?v17Clients:[]).filter(c=>!q||String(c.full_name||'').toLowerCase().includes(q)||String(c.contact||'').toLowerCase().includes(q));
      [...document.querySelectorAll('#clientList .client-card')].forEach((card,i)=>{
        const client=rows[i],top=card.querySelector('.client-card-top');if(!client||!top||top.querySelector('.v17g-client-remove'))return;
        const remove=document.createElement('button');remove.type='button';remove.className='v17g-client-remove';remove.textContent='Remove';remove.onclick=e=>{e.preventDefault();e.stopPropagation();removeClientProfile(client);};top.appendChild(remove);
      });
    };
    if($g('clientSearch'))$g('clientSearch').oninput=renderV17Clients;
    setTimeout(()=>{if(typeof v17Clients!=='undefined'&&v17Clients.length)renderV17Clients();},500);
  }
  const oldOpenClient=(typeof openV17Client==='function')?openV17Client:null;
  if(oldOpenClient){
    openV17Client=async function(id){
      await oldOpenClient(id);
      const actions=$g('clientDetailSection')?.querySelector('.client-detail-actions');if(!actions)return;
      let remove=$g('v17gRemoveClientBtn');if(!remove){remove=document.createElement('button');remove.id='v17gRemoveClientBtn';remove.type='button';remove.className='v17g-client-remove-detail';remove.textContent='Remove Client';actions.appendChild(remove);}
      remove.onclick=()=>{if(typeof v17SelectedClient!=='undefined'&&v17SelectedClient)removeClientProfile(v17SelectedClient);};
    };
  }

  // Mobile dock for daily admin use.
  const dock=document.createElement('nav');dock.className='v17g-mobile-dock';dock.setAttribute('aria-label','Admin quick actions');dock.innerHTML=`
    <button type="button" data-jump="todayCommandSection"><b>◷</b>Today</button>
    <button type="button" data-jump="quickBookingForm"><b>＋</b>Book</button>
    <button type="button" class="alert" data-count="0"><b>●</b>Alerts</button>
    <button type="button" data-jump="clientHubSection"><b>♙</b>Clients</button>
    <button type="button" class="menu"><b>☰</b>Menu</button>`;admin.appendChild(dock);
  dock.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.jump));dock.querySelector('.alert').onclick=()=>$g('adminNotificationBtn')?.click();dock.querySelector('.menu').onclick=()=>$g('adminMenuBtn')?.click();

  // Make deep links/section jumps land below sticky bars.
  document.querySelectorAll('#adminView main section[id],#quickBookingForm').forEach(el=>el.style.scrollMarginTop='128px');
  setTimeout(()=>{syncActionStrip();applyTodayFilter();const f=$g('v17gFreshness');if(f)f.textContent=`Updated ${new Date().toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'})}`;},700);
})();
