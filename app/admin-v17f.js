// Pickyla v17-F admin overlay
// Pending-action reminder, program journey, progress timeline, self-assessment linking,
// and downloadable client-safe progress cards.

(function(){
  const $f=id=>document.getElementById(id);
  const reminderDialog=$f('adminReminderDialog'),reminderSummary=$f('adminReminderSummary'),reminderCount=$f('adminNotificationCount');
  const reminderBtn=$f('adminNotificationBtn'),reminderPref=$f('adminReminderEveryVisit');
  const REMINDER_KEY='pickyla-v17f-admin-reminder-every-visit';
  let reminderShownThisVisit=false,v17fProgressDataUrl='';
  const scoreDefs=[
    ['serve','Serve'],['return_score','Return'],['forehand','Forehand'],['backhand','Backhand'],['dinking','Dinking'],
    ['footwork','Footwork'],['positioning','Positioning'],['consistency','Consistency'],['strategy','Strategy'],['confidence','Confidence']
  ];
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const reminderEnabled=()=>localStorage.getItem(REMINDER_KEY)!=='0';
  if(reminderPref)reminderPref.checked=reminderEnabled();

  function bookingEnd(b){const d=new Date(`${b.session_date}T00:00:00`);d.setHours(Number(b.end_hour),0,0,0);return d;}
  async function loadAdminReminder(show=false){
    if(!reminderSummary)return 0;
    const today=typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);
    const [{data:inq,error:ie},{data:tests,error:te},{data:books,error:be}]=await Promise.all([
      db.from('inquiries').select('id,client_name,status,created_at').in('status',['new','waiting','tentative']).order('created_at',{ascending:false}),
      db.from('testimonials').select('id,display_name,review_status,created_at').eq('review_status','pending').order('created_at',{ascending:false}),
      db.from('bookings').select('id,client_name,session_date,start_hour,end_hour,status,session_status,total_amount,amount_paid').lte('session_date',today).neq('status','cancelled').order('session_date',{ascending:false})
    ]);
    if(ie||te||be){reminderSummary.innerHTML=`<div class="empty">Could not load all reminders. ${(ie||te||be)?.message||''}</div>`;return 0;}
    const now=new Date(),needsClosing=(books||[]).filter(b=>(b.session_status||'scheduled')==='scheduled'&&bookingEnd(b)<now),collections=(books||[]).filter(b=>b.session_status==='completed'&&Math.max(0,Number(b.total_amount||0)-Number(b.amount_paid||0))>0);
    const items=[
      {count:(inq||[]).length,title:'Booking / coaching requests',desc:(inq||[]).slice(0,3).map(x=>x.client_name).join(' • ')||'No pending inquiries',target:'inquirySection'},
      {count:(tests||[]).length,title:'Testimonials for review',desc:(tests||[]).slice(0,3).map(x=>x.display_name).join(' • ')||'No testimonial waiting for approval',target:'shareToolsSection'},
      {count:needsClosing.length,title:'Sessions that need closing',desc:needsClosing.slice(0,3).map(x=>`${x.client_name} • ${x.session_date}`).join(' • ')||'No finished session waiting for status',target:'todayCommandSection'},
      {count:collections.length,title:'Completed sessions with balance',desc:collections.slice(0,3).map(x=>x.client_name).join(' • ')||'No completed session with outstanding collection',target:'collectionAlertSection'}
    ];
    const total=items.reduce((a,x)=>a+x.count,0);
    if(reminderCount)reminderCount.textContent=String(total);
    reminderBtn?.classList.toggle('v17f-clear',total===0);
    reminderSummary.innerHTML=items.map(x=>`<article class="v17f-reminder-item"><div class="count">${x.count}</div><div><h4>${safe(x.title)}</h4><p>${safe(x.desc)}</p></div><button type="button" data-target="${x.target}" ${x.count===0?'disabled':''}>Open</button></article>`).join('');
    reminderSummary.querySelectorAll('[data-target]').forEach(btn=>btn.onclick=()=>{reminderDialog?.close();document.getElementById(btn.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});});
    if(show&&reminderDialog&&!reminderDialog.open)reminderDialog.showModal();
    return total;
  }
  if(reminderBtn)reminderBtn.onclick=()=>loadAdminReminder(true);
  $f('closeAdminReminder')?.addEventListener('click',()=>reminderDialog?.close());
  $f('dismissAdminReminder')?.addEventListener('click',()=>reminderDialog?.close());
  $f('refreshAdminReminder')?.addEventListener('click',()=>loadAdminReminder(false));
  reminderPref?.addEventListener('change',()=>localStorage.setItem(REMINDER_KEY,reminderPref.checked?'1':'0'));

  async function maybeAutoReminder(){
    const {data:{session}}=await db.auth.getSession();if(!session)return;
    const total=await loadAdminReminder(false);
    if(total>0&&reminderEnabled()&&!reminderShownThisVisit){reminderShownThisVisit=true;setTimeout(()=>{if(reminderDialog&&!reminderDialog.open)reminderDialog.showModal();},250);}
  }
  db.auth.onAuthStateChange((_event,session)=>{if(session)setTimeout(maybeAutoReminder,500);});
  setTimeout(maybeAutoReminder,900);
  setInterval(()=>{if($f('adminView')&&!$f('adminView').classList.contains('hidden'))loadAdminReminder(false);},60000);

  // Link the public self-assessment after an inquiry is successfully converted to a confirmed booking.
  const bookingForm=$f('quickBookingForm'),originalBookingSubmit=bookingForm?.onsubmit;
  if(bookingForm&&originalBookingSubmit){
    bookingForm.onsubmit=async function(e){
      const inquiryId=(typeof v17dLoadedInquiryId!=='undefined')?v17dLoadedInquiryId:null;
      const sessionDate=$f('bookingDate')?.value,startHour=Number($f('bookingStart')?.value),endHour=Number($f('bookingEnd')?.value);
      const participants=(typeof v17dCurrentAdminParticipants==='function')?v17dCurrentAdminParticipants():[];
      const primaryName=participants[0]&&typeof v17dFull==='function'?v17dFull(participants[0]):'';
      await originalBookingSubmit.call(this,e);
      if(inquiryId){
        try{
          const {data:inq}=await db.from('inquiries').select('status').eq('id',inquiryId).maybeSingle();
          if(inq?.status==='confirmed'){
            const {data:self}=await db.from('inquiry_self_assessments').select('*').eq('inquiry_id',inquiryId).maybeSingle();
            if(self){
              const {data:bookRows}=await db.from('bookings').select('id,client_id,client_name').eq('session_date',sessionDate).eq('start_hour',startHour).eq('end_hour',endHour).order('created_at',{ascending:false}).limit(1);const book=bookRows?.[0];
              if(book?.client_id){
                const {data:existing}=await db.from('progress_assessments').select('id').eq('source_inquiry_id',inquiryId).eq('assessment_source','client_self').maybeSingle();
                if(!existing){
                  const row={client_id:book.client_id,booking_id:book.id,assessment_date:(self.created_at||new Date().toISOString()).slice(0,10),assessment_type:'initial',assessment_source:'client_self',source_inquiry_id:inquiryId,coach_note:self.note||null};
                  scoreDefs.forEach(([key])=>{row[key]=self[key]??null;});
                  const {error}=await db.from('progress_assessments').insert(row);if(error)console.warn('Self-assessment link:',error.message);else toast('Initial self-assessment linked to client profile');
                }
              }
            }
          }
        }catch(err){console.warn('v17-F self-assessment linking:',err);}
      }
      await loadAdminReminder(false);
    };
  }

  // Program journey + assessment timeline appended to the existing client profile.
  const oldOpenClient=(typeof openV17Client==='function')?openV17Client:null;
  async function renderProgramJourney(clientId){
    const wrap=$f('v17fProgramJourney');if(!wrap)return;
    const {data:enrollments,error}=await db.from('client_programs').select('*').eq('client_id',clientId).order('created_at',{ascending:false});
    if(error){wrap.innerHTML=`<div class="empty">${safe(error.message)}</div>`;return;}if(!(enrollments||[]).length){wrap.innerHTML='<div class="empty">No program enrollment yet.</div>';return;}
    const eids=enrollments.map(x=>x.id),pids=[...new Set(enrollments.map(x=>x.program_id))];
    const [{data:programs},{data:goals},{data:books}]=await Promise.all([
      db.from('coaching_programs').select('*').in('id',pids),
      db.from('coaching_program_sessions').select('*').in('program_id',pids).order('session_number'),
      db.from('bookings').select('client_program_id,program_session_number,session_status,status,session_date,start_hour').in('client_program_id',eids).order('session_date')
    ]);
    const pm=new Map((programs||[]).map(x=>[x.id,x]));wrap.innerHTML='';
    enrollments.forEach(en=>{
      const program=pm.get(en.program_id),box=document.createElement('div');box.className='v17f-journey-program';
      const list=(goals||[]).filter(x=>x.program_id===en.program_id).sort((a,b)=>a.session_number-b.session_number);
      box.innerHTML=`<div class="client-program-top"><div><h4>${safe(program?.name||'Program')}</h4><p>${safe(program?.overall_goal||'Structured coaching journey')}</p></div><span class="status-pill-v17 status-${safe(en.status)}">${safe(en.status)}</span></div>`;
      const rows=document.createElement('div');rows.className='v17f-program-journey';
      list.forEach(g=>{const linked=(books||[]).filter(b=>b.client_program_id===en.id&&Number(b.program_session_number)===Number(g.session_number)&&b.status!=='cancelled');let state='Not scheduled',cls='';const completed=linked.find(b=>b.session_status==='completed'),scheduled=linked.find(b=>b.session_status==='scheduled');if(completed){state='Completed';cls='completed';}else if(scheduled){state=`Scheduled ${scheduled.session_date}`;cls='scheduled';}else if(linked.length){state=(linked[linked.length-1].session_status||'Not scheduled').replaceAll('_',' ');}const row=document.createElement('div');row.className='v17f-journey-row';row.innerHTML=`<div class="v17f-journey-num">${g.session_number}</div><div><strong>${safe(g.title||`Session ${g.session_number}`)}</strong><small>${safe(g.goal||'No specific goal saved yet.')}</small></div><span class="v17f-journey-state ${cls}">${safe(state)}</span>`;rows.appendChild(row);});
      box.appendChild(rows);wrap.appendChild(box);
    });
  }
  async function renderProgressHistory(clientId){
    const wrap=$f('v17fProgressHistory');if(!wrap)return;
    const {data:rows,error}=await db.from('progress_assessments').select('*').eq('client_id',clientId).order('assessment_date',{ascending:false}).order('created_at',{ascending:false});
    if(error){wrap.innerHTML=`<div class="empty">${safe(error.message)}</div>`;return;}if(!(rows||[]).length){wrap.innerHTML='<div class="empty">No assessment history yet.</div>';return;}
    wrap.innerHTML=(rows||[]).slice(0,12).map(a=>{const source=a.assessment_source==='client_self'?'CLIENT SELF-ASSESSMENT':'COACH ASSESSMENT';const scores=scoreDefs.filter(([k])=>a[k]!=null).map(([k,l])=>`<span>${safe(l)} <strong>${a[k]}/5</strong></span>`).join('');return `<article class="v17f-progress-row"><div class="v17f-progress-row-head"><h4>${safe(a.assessment_date)} • ${safe(String(a.assessment_type||'session').replaceAll('_',' ').toUpperCase())}</h4><span class="v17f-progress-source">${source}</span></div>${a.coach_note?`<p>${safe(a.coach_note)}</p>`:''}<div class="v17f-progress-mini">${scores||'<span>No scores recorded</span>'}</div></article>`;}).join('');
  }
  if(oldOpenClient){
    openV17Client=async function(id){await oldOpenClient(id);await Promise.all([renderProgramJourney(id),renderProgressHistory(id)]);};
  }

  // Show the goal of the next program session in booking mode.
  const oldPrepare=(typeof prepareV17ProgramBooking==='function')?prepareV17ProgramBooking:null;
  if(oldPrepare){
    prepareV17ProgramBooking=function(enrollment,program,nextSession){oldPrepare(enrollment,program,nextSession);db.from('coaching_program_sessions').select('title,goal').eq('program_id',program.id).eq('session_number',nextSession).maybeSingle().then(({data})=>{if(data&&$f('bookingHint'))$f('bookingHint').textContent=`PROGRAM MODE • ${program.name} • Session ${nextSession}/${program.session_count} • ${data.title||`Session ${nextSession}`} — ${data.goal||'Goal not set yet.'} Fixed package: no separate hourly charge.`;});};
  }

  // Downloadable progress tracker card.
  function wrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){const words=String(text||'').split(/\s+/);let line='',lines=[];for(const w of words){const test=line?`${line} ${w}`:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w;if(lines.length>=maxLines-1)break;}else line=test;}if(line&&lines.length<maxLines)lines.push(line);lines.forEach((ln,i)=>ctx.fillText(ln,x,y+i*lineHeight));return y+lines.length*lineHeight;}
  function canvasImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
  async function programLineForClient(clientId){
    const {data:ens}=await db.from('client_programs').select('*').eq('client_id',clientId).in('status',['active','completed']).order('created_at',{ascending:false}).limit(1);const en=ens?.[0];if(!en)return '';
    const [{data:p},{count}]=await Promise.all([db.from('coaching_programs').select('name,session_count').eq('id',en.program_id).maybeSingle(),db.from('bookings').select('id',{count:'exact',head:true}).eq('client_program_id',en.id).eq('session_status','completed').neq('status','cancelled')]);return p?`${p.name} • ${Number(count||0)}/${p.session_count} sessions completed`:'';
  }
  async function generateProgressCard(){
    if(typeof v17SelectedClient==='undefined'||!v17SelectedClient)return alert('Open a client profile first.');
    const client=v17SelectedClient,{data:rows,error}=await db.from('progress_assessments').select('*').eq('client_id',client.id).order('assessment_date',{ascending:true}).order('created_at',{ascending:true});
    if(error)return alert(error.message);if(!(rows||[]).length)return alert('Add an initial or progress assessment first.');
    const assessments=rows||[],baseline=assessments.find(x=>x.assessment_type==='initial')||assessments[0],current=assessments[assessments.length-1],programLine=await programLineForClient(client.id);
    const W=1600,H=2000,c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
    ctx.fillStyle='#f7f7f3';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111';ctx.fillRect(0,0,W,310);ctx.fillStyle='#f5c400';ctx.fillRect(0,304,W,6);
    try{const img=await canvasImage('pickyla-emblem-final.png');ctx.drawImage(img,68,48,190,190);}catch(_e){}
    ctx.fillStyle='#fff';ctx.font='900 64px Arial';ctx.fillText('PLAYER PROGRESS TRACKER',300,112);ctx.fillStyle='#f5c400';ctx.font='800 34px Arial';ctx.fillText(client.full_name||'Pickyla Client',300,170);ctx.fillStyle='#cfcfcf';ctx.font='500 23px Arial';ctx.fillText(`Generated ${new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}`,300,214);if(programLine){ctx.fillStyle='#fff';ctx.font='700 22px Arial';ctx.fillText(programLine,300,255);}
    ctx.fillStyle='#111';ctx.font='900 30px Arial';ctx.fillText('SKILL DEVELOPMENT',74,385);ctx.font='500 19px Arial';ctx.fillStyle='#666';ctx.fillText('Baseline vs current assessment • 1 = Needs Foundation • 5 = Strong',74,420);
    const startY=475,rowH=118,labelX=80,barX=430,barW=700;
    scoreDefs.forEach(([key,label],i)=>{const y=startY+i*rowH,b=Number(baseline[key]||0),cur=Number(current[key]||0),delta=cur&&b?cur-b:null;ctx.fillStyle=i%2?'#fff':'#f0efe8';ctx.fillRect(62,y-42,1476,96);ctx.fillStyle='#111';ctx.font='800 25px Arial';ctx.fillText(label,labelX,y);ctx.fillStyle='#ddd';ctx.fillRect(barX,y-19,barW,24);if(cur){ctx.fillStyle='#f5c400';ctx.fillRect(barX,y-19,(barW/5)*cur,24);}ctx.fillStyle='#111';ctx.font='800 22px Arial';ctx.fillText(`Baseline ${b||'—'}`,1170,y);ctx.fillText(`Current ${cur||'—'}`,1320,y);if(delta!==null){ctx.fillStyle=delta>0?'#267033':delta<0?'#a52b2b':'#666';ctx.font='900 22px Arial';ctx.fillText(delta>0?`+${delta}`:`${delta}`,1490,y);}});
    let y=1710;ctx.fillStyle='#111';ctx.font='900 28px Arial';ctx.fillText('LATEST NOTE',74,y);ctx.font='500 22px Arial';ctx.fillStyle='#444';const note=current.coach_note||(current.assessment_source==='client_self'?'Initial self-assessment saved.':'No note saved for the latest assessment.');y=wrapText(ctx,note,74,y+42,1450,32,4);
    ctx.fillStyle='#111';ctx.fillRect(0,H-145,W,145);ctx.fillStyle='#f5c400';ctx.font='900 28px Arial';ctx.fillText('PICKYLA',74,H-84);ctx.fillStyle='#fff';ctx.font='500 20px Arial';ctx.fillText('Pickleball Coaching • Santiago City, Isabela',74,H-49);ctx.textAlign='right';ctx.fillStyle='#bbb';ctx.fillText(`${assessments.length} assessment${assessments.length===1?'':'s'} recorded`,W-74,H-66);ctx.textAlign='left';
    v17fProgressDataUrl=c.toDataURL('image/png');$f('progressCardPreview').src=v17fProgressDataUrl;$f('progressCardDialog')?.showModal();
  }
  $f('generateProgressCardBtn')?.addEventListener('click',generateProgressCard);
  $f('closeProgressCard')?.addEventListener('click',()=>{$f('progressCardDialog')?.close();});
  $f('cancelProgressCard')?.addEventListener('click',()=>{$f('progressCardDialog')?.close();});
  $f('downloadProgressCard')?.addEventListener('click',()=>{if(!v17fProgressDataUrl||typeof v17SelectedClient==='undefined'||!v17SelectedClient)return;const a=document.createElement('a');a.href=v17fProgressDataUrl;a.download=`pickyla-progress-${String(v17SelectedClient.full_name||'client').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${new Date().toISOString().slice(0,10)}.png`;a.click();});
})();
