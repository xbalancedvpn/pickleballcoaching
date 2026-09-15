// Pickyla v17-G admin loader + client-edit fallback
(function(){
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}

  function installEditFallback(){
    if(document.querySelector('.v17g-client-edit,.v17g-client-edit-detail'))return;
    const byId=id=>document.getElementById(id),clean=v=>String(v||'').trim().replace(/\s+/g,' ');
    const title=v=>clean(v).split(' ').map(w=>w?w.charAt(0).toUpperCase()+w.slice(1).toLowerCase():w).join(' ');
    const splitName=c=>{if(c?.first_name)return{first_name:c.first_name,last_name:c.last_name||''};const p=clean(c?.full_name).split(' ').filter(Boolean);return{first_name:p.shift()||'',last_name:p.join(' ')}};
    let selected=null;

    const dialog=document.createElement('dialog');dialog.className='v17g-client-maintenance-dialog';dialog.innerHTML=`<form id="v17gFallbackEditForm" class="v17g-client-maintenance-card">
      <div class="v17g-maint-head"><div><span>CLIENT PROFILE</span><h2>Edit Client</h2><p>Correct the name/contact so future bookings reuse this same client profile.</p></div><button type="button" id="v17gFallbackEditClose">×</button></div>
      <div class="v17g-maint-grid"><label>First name<input id="v17gFallbackFirst" required maxlength="60"></label><label>Last name<input id="v17gFallbackLast" required maxlength="80" placeholder="Add surname / second name"></label></div>
      <label>Contact<input id="v17gFallbackContact" maxlength="120" placeholder="Messenger / mobile (optional)"></label>
      <label>Coach notes<textarea id="v17gFallbackNotes" rows="3" maxlength="1000" placeholder="Optional"></textarea></label>
      <div class="v17g-maint-hint">Saving updates the client identity and linked primary booking display name. Existing payments and session history stay intact.</div>
      <div class="v17g-maint-actions"><button type="button" class="secondary" id="v17gFallbackCancel">Cancel</button><button type="submit" class="primary">Save Client</button></div>
    </form>`;document.body.appendChild(dialog);
    byId('v17gFallbackEditClose').onclick=()=>dialog.close();byId('v17gFallbackCancel').onclick=()=>dialog.close();

    function openEdit(client){selected=client;const p=splitName(client);byId('v17gFallbackFirst').value=p.first_name||'';byId('v17gFallbackLast').value=p.last_name||'';byId('v17gFallbackContact').value=client.contact||'';byId('v17gFallbackNotes').value=client.notes||'';dialog.showModal();}
    byId('v17gFallbackEditForm').onsubmit=async e=>{e.preventDefault();if(!selected)return;const first=title(byId('v17gFallbackFirst').value),last=title(byId('v17gFallbackLast').value);if(!first||!last)return alert('First name and last name are required.');const btn=e.submitter;btn.disabled=true;btn.textContent='Saving…';const {error}=await db.rpc('admin_update_client_identity',{p_client_id:selected.id,p_first_name:first,p_last_name:last,p_contact:clean(byId('v17gFallbackContact').value)||null,p_notes:clean(byId('v17gFallbackNotes').value)||null});btn.disabled=false;btn.textContent='Save Client';if(error)return alert(error.message);dialog.close();toast('Client profile updated');await loadV17Clients();if(typeof openV17Client==='function')await openV17Client(selected.id);};

    const priorRender=typeof renderV17Clients==='function'?renderV17Clients:null;
    if(priorRender){renderV17Clients=function(){priorRender();const q=String(byId('clientSearch')?.value||'').trim().toLowerCase();const rows=(typeof v17Clients!=='undefined'?v17Clients:[]).filter(c=>!q||String(c.full_name||'').toLowerCase().includes(q)||String(c.contact||'').toLowerCase().includes(q));[...document.querySelectorAll('#clientList .client-card')].forEach((card,i)=>{const c=rows[i],top=card.querySelector('.client-card-top');if(!c||!top||top.querySelector('.v17g-client-edit-fallback'))return;const b=document.createElement('button');b.type='button';b.className='v17g-client-edit v17g-client-edit-fallback';b.textContent='Edit';b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();openEdit(c);};top.appendChild(b);});};if(byId('clientSearch'))byId('clientSearch').oninput=renderV17Clients;renderV17Clients();}

    const priorOpen=typeof openV17Client==='function'?openV17Client:null;
    if(priorOpen){openV17Client=async function(id){await priorOpen(id);const c=typeof v17SelectedClient!=='undefined'?v17SelectedClient:null,actions=byId('clientDetailSection')?.querySelector('.client-detail-actions');if(!c||!actions)return;let b=byId('v17gFallbackEditClientBtn');if(!b){b=document.createElement('button');b.id='v17gFallbackEditClientBtn';b.type='button';b.className='v17g-client-edit-detail';b.textContent='Edit Client';actions.prepend(b);}b.onclick=()=>openEdit(c);};}
  }

  load('admin-v17g-core.js?v=17g-maint4').then(()=>load('admin-client-maintenance.js?v=17g-maint4')).catch(err=>console.warn('Pickyla client maintenance overlay:',err)).finally(()=>setTimeout(installEditFallback,500));
})();
