// Pickyla v17-G admin loader
(function(){
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  load('admin-v17g-core.js?v=17g').then(()=>load('admin-client-maintenance.js?v=17g-maint')).catch(err=>console.error('Pickyla admin loader:',err));
})();
