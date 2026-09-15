// Pickyla v17-G public polish
(function(){
  const nav=document.getElementById('mainNav');
  if(!nav)return;
  const known=[
    ['home','Home'],['about','Coach'],['improve','Find My Coaching'],['programs','Programs'],['rates','Rates'],
    ['testimonialsSection','Testimonials'],['booking','Schedule'],['contact','Contact']
  ];
  // Keep the menu synchronized with public features that exist on the page.
  known.forEach(([id,label])=>{
    if(!document.getElementById(id))return;
    if(nav.querySelector(`[data-public-tab="${id}"]`))return;
    const a=document.createElement('a');a.href=`#${id}`;a.dataset.publicTab=id;a.textContent=label;
    a.addEventListener('click',e=>{e.preventDefault();document.getElementById('mainNav')?.classList.remove('open');document.getElementById('menuBtn')?.setAttribute('aria-expanded','false');history.replaceState(null,'',id==='home'?location.pathname+location.search:`#${id}`);window.pickylaShowPublicTab?.(id,true);});
    nav.insertBefore(a,nav.querySelector('.admin-login-link')||null);
  });

  const bar=document.createElement('div');bar.id='v17gFocusBar';bar.className='v17g-focusbar';bar.innerHTML=`
    <div class="v17g-focusbar-copy"><span>Viewing</span><strong id="v17gFocusTitle">Section</strong></div>
    <div class="v17g-focusbar-actions"><button type="button" class="v17g-viewall">View All</button><button type="button" class="v17g-next">Next</button></div>`;
  const main=document.querySelector('main');main?.insertBefore(bar,main.firstChild);
  const title=bar.querySelector('#v17gFocusTitle'),viewAll=bar.querySelector('.v17g-viewall'),next=bar.querySelector('.v17g-next');
  const tabs=()=>[...nav.querySelectorAll('a[data-public-tab]')].filter(a=>a.dataset.publicTab!=='home'&&document.getElementById(a.dataset.publicTab));
  function currentId(){return document.querySelector('main > section.v17f-active-section')?.id||'';}
  function sectionLabel(id){const a=nav.querySelector(`[data-public-tab="${CSS.escape(id)}"]`);if(a)return a.textContent.trim();const s=document.getElementById(id);return s?.querySelector('h1,h2')?.textContent.trim()||'Section';}
  function sync(){const id=currentId();if(!id){bar.style.display='';return;}title.textContent=sectionLabel(id);const list=tabs(),i=list.findIndex(a=>a.dataset.publicTab===id),n=list[i+1];next.disabled=!n;next.textContent=n?`Next: ${n.textContent.trim()}`:'Last Section';}
  viewAll.onclick=()=>{history.replaceState(null,'',location.pathname+location.search);window.pickylaShowPublicTab?.('home',true);};
  next.onclick=()=>{const id=currentId(),list=tabs(),i=list.findIndex(a=>a.dataset.publicTab===id),n=list[i+1];if(!n)return;n.click();};
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:false});
  document.addEventListener('click',e=>{if(e.target.closest('#mainNav,[data-public-tab]'))setTimeout(sync,0);});
  window.addEventListener('hashchange',()=>setTimeout(sync,0));
  setTimeout(sync,100);
})();
