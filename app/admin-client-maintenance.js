// Pickyla v17-G client maintenance overlay
(function(){
  const $m=id=>document.getElementById(id);
  const clean=v=>String(v||'').trim().replace(/\s+/g,' ');
  const title=v=>clean(v).split(' ').map(w=>w.split(/([-'])/).map(p=>/[-']/.test(p)?p:(p?p.charAt(0).toUpperCase()+p.slice(1).toLowerCase():p)).join('')).join(' ');
  const splitFirstLast=full=>{const parts=clean(full).split(' ').filter(Boolean);return{first_name:parts.shift()||'',last_name:parts.join(' ')};};
  const looksCombined=name=>/\s+(?:and|&)\s+|\//i.test(String(name||''));
  let editClient=null,splitClient=null;

  const editDialog=document.createElement('dialog');editDialog.className='v17g-client-maintenance-dialog';editDialog.innerHTML=`<form method="dialog" class="v17g-client-maintenance-card" id="v17gEditClientForm">
    <div class="v17g-maint-head"><div><span>CLIENT PROFILE</span><h2>Edit Client</h2><p>Correct the client identity so future bookings reuse the same profile instead of creating duplicates.</p></div><button type="button" data-close>×</button></div>
    <div class="v17g-maint-grid"><label>First name<input id="v17gEditFirst" required maxlength="60"></label><label>Last name<input id="v17gEditLast" required maxlength="80"></label></div>
    <label>Contact<input id="v17gEditContact" maxlength="120" placeholder="Messenger / mobile (optional)"></label>
    <label>Coach notes<textarea id="v17gEditNotes" rows="3" maxlength="1000" placeholder="Optional"></textarea></label>
    <div id="v17gEditHint" class="v17g-maint-hint"></div>
    <div class="v17g-maint-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary">Save Client</button></div>
  </form>`;
  document.body.appendChild(editDialog);
  editDialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>editDialog.close());

  const splitDialog=document.createElement('dialog');splitDialog.className='v17g-client-maintenance-dialog';splitDialog.innerHTML=`<form method="dialog" class="v17g-client-maintenance-card wide" id="v17gSplitClientForm">
    <div class="v17g-maint-head"><div><span>LEGACY CLEANUP</span><h2>Split 2-Person Client</h2><p>Turns one old combined profile into two individual clients while keeping the same booking and payment history.</p></div><button type="button" data-close>×</button></div>
    <div class="v17g-split-grid">
      <section><strong>Player 1 / Primary</strong><label>First name<input id="v17gP1First" required maxlength="60"></label><label>Last name<input id="v17gP1Last" required maxlength="80"></label><label>Contact<input id="v17gP1Contact" maxlength="120" placeholder="Optional"></label><label>Notes<textarea id="v17gP1Notes" rows="2"></textarea></label></section>
      <section><strong>Player 2</strong><label>First name<input id="v17gP2First" required maxlength="60"></label><label>Last name<input id="v17gP2Last" required maxlength="80"></label><label>Contact<input id="v17gP2Contact" maxlength="120" placeholder="Optional"></label><label>Notes<textarea id="v17gP2Notes" rows="2"></textarea></label></section>
    </div>
    <div class="v17g-maint-hint">The old combined name disappears. Player 1 keeps the original primary booking link; Player 2 is added as an individual participant in the same historical bookings.</div>
    <div class="v17g-maint-actions"><button type="button" class="secondary" data-close>Cancel</button><button type="submit" class="primary">Split & Save</button></div>
  </form>`;
  document.body.appendChild(splitDialog);
  splitDialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>splitDialog.close());

  function clientParts(client){
    if(client?.first_name&&client?.last_name)return{first_name:client.first_name,last_name:client.last_name};
    return splitFirstLast(client?.full_name||'');
  }
  async function openEdit(client){
    editClient=client;const p=clientParts(client);
    $m('v17gEditFirst').value=p.first_name||'';$m('v17gEditLast').value=p.last_name||'';$m('v17gEditContact').value=client.contact||'';$m('v17gEditNotes').value=client.notes||'';
    $m('v17gEditHint').textContent=looksCombined(client.full_name)?'This looks like an old combined 2-person record. Use “Split Pair” from the client profile if these are two different people.':'Saving also updates the linked primary booking display name and participant identity.';
    editDialog.showModal();
  }
  async function bestPairSeed(client){
    let candidates=[];
    try{const {data}=await db.from('bookings').select('client_name,session_date').eq('client_id',client.id).order('session_date',{ascending:false});candidates=(data||[]).map(x=>x.client_name).filter(Boolean);}catch(_e){}
    candidates.push(client.full_name||'');
    let pair=null;
    for(const c of candidates){if(String(c).includes('/')){pair=String(c).split('/').slice(0,2);break;}}
    if(!pair){for(const c of candidates){const m=String(c).split(/\s+(?:and|&)\s+/i);if(m.length>=2){pair=m.slice(0,2);break;}}}
    pair=pair||[client.full_name||'',''];
    return pair.map(x=>splitFirstLast(title(x)));
  }
  async function openSplit(client){
    splitClient=client;const [a,b]=await bestPairSeed(client);
    $m('v17gP1First').value=a.first_name||'';$m('v17gP1Last').value=a.last_name||'';$m('v17gP1Contact').value=client.contact||'';$m('v17gP1Notes').value=client.notes||'';
    $m('v17gP2First').value=b.first_name||'';$m('v17gP2Last').value=b.last_name||'';$m('v17gP2Contact').value='';$m('v17gP2Notes').value='';
    splitDialog.showModal();
  }

  $m('v17gEditClientForm').onsubmit=async e=>{e.preventDefault();if(!editClient)return;
    const args={p_client_id:editClient.id,p_first_name:title($m('v17gEditFirst').value),p_last_name:title($m('v17gEditLast').value),p_contact:clean($m('v17gEditContact').value)||null,p_notes:clean($m('v17gEditNotes').value)||null};
    if(!args.p_first_name||!args.p_last_name)return alert('First name and last name are required.');
    const btn=e.submitter;btn.disabled=true;btn.textContent='Saving…';const {error}=await db.rpc('admin_update_client_identity',args);btn.disabled=false;btn.textContent='Save Client';if(error)return alert(error.message);
    editDialog.close();toast('Client profile updated');await loadV17Clients();if(typeof openV17Client==='function')await openV17Client(editClient.id);
  };
  $m('v17gSplitClientForm').onsubmit=async e=>{e.preventDefault();if(!splitClient)return;
    const args={p_client_id:splitClient.id,p_primary_first:title($m('v17gP1First').value),p_primary_last:title($m('v17gP1Last').value),p_secondary_first:title($m('v17gP2First').value),p_secondary_last:title($m('v17gP2Last').value),p_primary_contact:clean($m('v17gP1Contact').value)||null,p_secondary_contact:clean($m('v17gP2Contact').value)||null,p_primary_notes:clean($m('v17gP1Notes').value)||null,p_secondary_notes:clean($m('v17gP2Notes').value)||null};
    if(!args.p_primary_first||!args.p_primary_last||!args.p_secondary_first||!args.p_secondary_last)return alert('Both players need a complete first name and last name.');
    if(!confirm(`Split ${splitClient.full_name} into:\n\n1. ${args.p_primary_first} ${args.p_primary_last}\n2. ${args.p_secondary_first} ${args.p_secondary_last}\n\nHistorical bookings and payments will be preserved.`))return;
    const btn=e.submitter;btn.disabled=true;btn.textContent='Splitting…';const {data,error}=await db.rpc('admin_split_legacy_client',args);btn.disabled=false;btn.textContent='Split & Save';if(error)return alert(error.message);
    splitDialog.close();toast('Legacy pair split into individual clients');await loadV17Clients();if(data?.primary_client_id&&typeof openV17Client==='function')await openV17Client(data.primary_client_id);
  };

  // Client list stays intentionally simple: one Edit button only.
  // Edit first opens the client profile, then opens the editor. Remove/Split live inside the profile.
  const oldRender=typeof renderV17Clients==='function'?renderV17Clients:null;
  if(oldRender){
    renderV17Clients=function(){
      oldRender();
      const q=String($m('clientSearch')?.value||'').trim().toLowerCase();
      const rows=(typeof v17Clients!=='undefined'?v17Clients:[]).filter(c=>!q||String(c.full_name||'').toLowerCase().includes(q)||String(c.contact||'').toLowerCase().includes(q));
      [...document.querySelectorAll('#clientList .client-card')].forEach((card,i)=>{
        const client=rows[i],top=card.querySelector('.client-card-top');if(!client||!top)return;
        top.querySelectorAll('.v17g-client-remove,.v17g-client-card-maint,.v17g-client-edit-fallback').forEach(el=>el.remove());
        const action=[...top.querySelectorAll('button')][0];if(!action)return;
        action.textContent='Edit';action.classList.add('v17g-client-edit','v17g-client-list-edit');
        action.onclick=async e=>{e.preventDefault();e.stopPropagation();if(typeof openV17Client==='function')await openV17Client(client.id);const current=(typeof v17SelectedClient!=='undefined'&&v17SelectedClient?.id===client.id)?v17SelectedClient:client;openEdit(current);};
      });
    };
    if($m('clientSearch'))$m('clientSearch').oninput=renderV17Clients;
    setTimeout(()=>{if(typeof v17Clients!=='undefined')renderV17Clients();},300);
  }

  const oldOpen=typeof openV17Client==='function'?openV17Client:null;
  if(oldOpen){
    openV17Client=async function(id){
      await oldOpen(id);
      const client=typeof v17SelectedClient!=='undefined'?v17SelectedClient:null,actions=$m('clientDetailSection')?.querySelector('.client-detail-actions');if(!client||!actions)return;
      let edit=$m('v17gEditClientBtn');if(!edit){edit=document.createElement('button');edit.id='v17gEditClientBtn';edit.type='button';edit.className='v17g-client-edit-detail';edit.textContent='Edit Client';actions.prepend(edit);}edit.onclick=()=>openEdit(client);
      let split=$m('v17gSplitClientBtn');if(looksCombined(client.full_name)){if(!split){split=document.createElement('button');split.id='v17gSplitClientBtn';split.type='button';split.className='v17g-client-split-detail';split.textContent='Split Pair';actions.insertBefore(split,actions.querySelector('.v17g-client-remove-detail')||null);}split.classList.remove('hidden');split.onclick=()=>openSplit(client);}else if(split)split.classList.add('hidden');
    };
  }

  window.pickylaClientMaintenanceReady=true;
})();
