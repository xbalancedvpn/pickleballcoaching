// Pickyla v17-F public overlay
// Focused menu tabs + optional Player 1 initial self-assessment.

(function(){
  const publicSections=[...document.querySelectorAll('main > section[id]')];
  const navLinks=[...document.querySelectorAll('#mainNav a[data-public-tab]')];

  function clearFocusedView(scroll=true){
    document.body.classList.remove('v17f-focused');
    publicSections.forEach(s=>s.classList.remove('v17f-active-section'));
    navLinks.forEach(a=>a.classList.toggle('v17f-active',a.dataset.publicTab==='home'));
    if(scroll) document.getElementById('home')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function showFocusedView(id,scroll=true){
    if(!id||id==='home'){clearFocusedView(scroll);return;}
    const target=document.getElementById(id);if(!target)return;
    document.body.classList.add('v17f-focused');
    publicSections.forEach(s=>s.classList.toggle('v17f-active-section',s.id===id));
    navLinks.forEach(a=>a.classList.toggle('v17f-active',a.dataset.publicTab===id));
    if(scroll) target.scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.pickylaShowPublicTab=showFocusedView;
  navLinks.forEach(a=>a.addEventListener('click',e=>{
    e.preventDefault();
    const id=a.dataset.publicTab;
    mainNav?.classList.remove('open');menuBtn?.setAttribute('aria-expanded','false');
    history.replaceState(null,'',id==='home'?location.pathname+location.search:`#${id}`);
    showFocusedView(id,true);
  }));
  document.querySelector('.brand')?.addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'',location.pathname+location.search);clearFocusedView(true);});
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a||a.closest('#mainNav')||a.classList.contains('brand'))return;
    const id=(a.getAttribute('href')||'').slice(1);const target=document.getElementById(id);
    if(target&&target.matches('main > section')){e.preventDefault();showFocusedView(id,true);history.replaceState(null,'',`#${id}`);}
  });
  if(location.hash){const id=location.hash.slice(1);if(id&&id!=='home'&&document.getElementById(id)?.matches('main > section'))showFocusedView(id,false);}

  const selfFields=[...document.querySelectorAll('[data-self-score]')];
  const selfNote=document.getElementById('v17fSelfAssessmentNote');
  function getSelfAssessment(){
    const row={};let any=false;
    selfFields.forEach(el=>{const v=el.value;if(v){row[el.dataset.selfScore]=Number(v);any=true;}});
    const note=cleanSpaces(selfNote?.value||'');if(note){row.note=note;any=true;}
    return any?row:null;
  }
  const originalBookingMessage=bookingMessage;
  bookingMessage=function(){
    const base=originalBookingMessage();if(!base)return base;
    return getSelfAssessment()?`${base}\nInitial Self-Assessment: Included for Player 1` : base;
  };

  if(sendRequestButton){
    sendRequestButton.onclick=async()=>{
      const players=getPublicParticipants(true),text=bookingMessage();if(!text||!players){updateSummary();return;}
      const original=sendRequestButton.textContent;sendRequestButton.disabled=true;sendRequestButton.textContent='Sending…';
      if(requestSubmitStatus){requestSubmitStatus.dataset.keep='1';requestSubmitStatus.className='request-submit-status hidden';}
      try{
        saveParticipantMemory(players);
        const selfAssessment=getSelfAssessment();
        const {data,error}=await db.rpc('submit_public_inquiry_v17f',{
          p_preferred_date:keyDate(selectedDate),p_start_hour:selectedStart,p_end_hour:selectedEnd,
          p_participant_count:players.length,p_coaching_type:selectedPackage,
          p_quoted_rate:Number(String(selectedRate||'').replace(/[^0-9.]/g,''))||null,
          p_source_text:text,p_goal_focus:selectedGoalLabel||null,
          p_program_interest:selectedProgramInterest?.name||null,p_participants:players,
          p_self_assessment:selfAssessment
        });
        if(error)throw error;
        requestSubmitStatus.className='request-submit-status ok';
        requestSubmitStatus.textContent=selfAssessment?
          'Request sent to Pickyla Admin. Your initial self-assessment was also saved as a starting baseline and will be linked after Kyla confirms the booking.':
          'Request sent to Pickyla Admin. Your slot is still subject to final confirmation by Kyla.';
      }catch(e){
        requestSubmitStatus.className='request-submit-status error';
        requestSubmitStatus.textContent=(e.message||'Could not send your request. Please try Messenger instead.')+(String(e.message||'').includes('submit_public_inquiry_v17f')?' Run the v17-F Supabase migration first.':'');
      }finally{
        sendRequestButton.disabled=false;sendRequestButton.textContent=original;
        setTimeout(()=>{if(requestSubmitStatus)delete requestSubmitStatus.dataset.keep;},1200);
      }
    };
  }
})();
