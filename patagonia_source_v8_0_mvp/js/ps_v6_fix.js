(function(){
'use strict';
function sb(){ return window.PS_BRIDGE && window.PS_BRIDGE.supabase ? window.PS_BRIDGE.supabase() : null; }
function cur(){ return window.CU || null; }
function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
function toastMsg(m,t){ if(typeof toast==='function') toast(m,t||'ok'); else console.log(m); }
function hasCompany(u){ return !!(u && u._sb_company_id); }
function isMaster(u){ return !!(u && u.role==='master'); }
function memberRole(u){ return String((u && u._sb_member_role)||'').toLowerCase(); }
function isOwner(u){ return isMaster(u) || memberRole(u)==='owner'; }
function isAdmin(u){ return memberRole(u)==='admin'; }
function canManageDocs(u){ return isOwner(u) || isAdmin(u); }
function verifiedStatus(v){ v=String(v||'').toLowerCase(); return v==='verificado'||v==='verified'||v==='approved'; }
function dateStr(v){ if(!v) return '—'; try{return new Date(v).toLocaleDateString('es-AR');}catch(e){return String(v);} }
function classifyEmployees(v){ return v==='1-10' ? 'Pequeña' : v==='11-50' ? 'Mediana' : v==='51-250' ? 'Grande' : v==='+250' ? 'Multinacional' : ''; }
function roleLabel(v){ v=String(v||'').toLowerCase(); return v==='owner'?'Owner':v==='admin'?'Admin':v==='member'?'Member':v==='viewer'?'Viewer':(v||'—'); }
function pill(v){ var s=String(v||'pendiente').toLowerCase(); var cls=verifiedStatus(s)?'ok':((s==='rejected'||s==='suspendido')?'bad':'warn'); return '<span class="ps6-pill '+cls+'">'+esc(s.replaceAll('_',' '))+'</span>'; }

function injectStyles(){
 if(document.getElementById('ps6-style')) return;
 var st=document.createElement('style');
 st.id='ps6-style';
 st.textContent=`
 .ps6-card{background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);padding:18px;margin-bottom:12px}
 .ps6-title{font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px}
 .ps6-help{font-size:.78rem;color:var(--t3);line-height:1.55}
 .ps6-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 .ps6-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
 .ps6-kv{display:grid;grid-template-columns:170px 1fr;gap:10px;padding:8px 0;border-bottom:1px dashed var(--brd2)}
 .ps6-kv:last-child{border-bottom:none}
 .ps6-k{font-size:.78rem;color:var(--t3)}
 .ps6-v{font-size:.84rem;color:var(--t2)}
 .ps6-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px}
 .ps6-banner{border:1px solid var(--brd);border-radius:10px;padding:12px;font-size:.82rem;line-height:1.6;margin-bottom:14px;background:rgba(199,125,10,.06);color:var(--t2)}
 .ps6-pill{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
 .ps6-pill.ok{background:rgba(44,168,94,.12);color:var(--grn)}
 .ps6-pill.warn{background:rgba(199,125,10,.12);color:var(--ac)}
 .ps6-pill.bad{background:rgba(221,68,68,.12);color:var(--red)}
 .ps6-stepbar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px}
 .ps6-stepitem{flex:1;min-width:120px}
 .ps6-stepitem .lbl{font-size:.74rem;color:var(--t3);margin-bottom:4px}
 .ps6-stepitem .bar{height:8px;border-radius:999px;background:var(--bg3);overflow:hidden}
 .ps6-stepitem .bar span{display:block;height:100%;background:var(--ac)}
 .ps6-doc{border:1px solid var(--brd);border-radius:12px;background:var(--bg1);padding:12px;margin-top:10px}
 .ps6-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
 .ps6-user{border:1px solid var(--brd);border-radius:12px;padding:12px;background:var(--bg1);margin-top:10px}
 @media(max-width:900px){.ps6-grid2,.ps6-grid3{grid-template-columns:1fr}.ps6-kv{grid-template-columns:1fr}}
 `;
 document.head.appendChild(st);
}

function ensurePages(){
 injectStyles();
 if(!document.getElementById('pg-mycompany')){
   var pg=document.createElement('div');
   pg.id='pg-mycompany'; pg.className='pg';
   pg.innerHTML='<div class="reg" style="max-width:1080px"><div class="reg-c" id="myCompanyContent"></div></div>';
   document.body.appendChild(pg);
 }
 if(!document.getElementById('psSheet')){
   var sh=document.createElement('div'); sh.id='psSheet'; sh.className='ps-sheet';
   sh.innerHTML='<div class="ps-sheet-card"><div id="psSheetContent"></div></div>';
   sh.addEventListener('click', function(e){ if(e.target===sh) closeSheet(); });
   document.body.appendChild(sh);
 }
}
function openSheet(html){ ensurePages(); document.getElementById('psSheetContent').innerHTML=html; document.getElementById('psSheet').classList.add('v'); }
function closeSheet(){ var el=document.getElementById('psSheet'); if(el) el.classList.remove('v'); }

function syncNav(){
 var w=document.getElementById('nIn'); if(!w) return;
 var btn=document.getElementById('nCompanyBtn'); var u=cur();
 if(u && hasCompany(u)){
   if(!btn){
     btn=document.createElement('button'); btn.id='nCompanyBtn'; btn.className='bt bt-g bt-sm'; btn.style.fontSize='.7rem'; btn.style.color='var(--t2)'; btn.textContent='Mi Empresa'; btn.onclick=function(){ go('mycompany'); };
     var pbtn=w.querySelector('button[onclick*="myprofile"]');
     if(pbtn && pbtn.parentNode) pbtn.parentNode.insertBefore(btn, pbtn.nextSibling); else w.insertBefore(btn, w.lastElementChild);
   }
   btn.style.display='inline-flex';
 } else if(btn){ btn.style.display='none'; }
}

function patchNavigation(){
 if(window.__ps6Go) return; window.__ps6Go=true;
 var _go=window.go;
 window.go=function(p){
   if(p==='mycompany'){ ensurePages(); if(_go) _go('mycompany'); setTimeout(renderMyCompany,60); return; }
   return _go ? _go.apply(this, arguments) : void 0;
 };
}

function patchRegisterPage(){
 var reg=document.getElementById('pg-register'); if(!reg || reg.dataset.ps6patched) return; reg.dataset.ps6patched='1';
 var tabs=reg.querySelector('.ts'); if(tabs) tabs.style.display='none';
 var fe=document.getElementById('fE'); var fi=document.getElementById('fI'); if(fe) fe.style.display='none'; if(fi) fi.style.display='block';
 var title=reg.querySelector('h2'); var desc=reg.querySelector('p'); if(title) title.textContent='Crear cuenta'; if(desc) desc.textContent='Registrate como persona. Después podrás registrar una empresa o esperar que una empresa te vincule internamente.';
 var btn=document.getElementById('regBtn'); if(btn) btn.textContent='Crear cuenta';
 var note=document.getElementById('regNote'); if(note) note.textContent='La cuenta se crea como usuario personal. La empresa se registra después, dentro de la app.';
 var sel=document.getElementById('rRolInd'); if(sel && sel.tagName.toLowerCase()==='select'){ var inp=document.createElement('input'); inp.id='rRolInd'; inp.placeholder='Ej: Analista de Compras, Responsable Comercial'; sel.parentElement.replaceChild(inp, sel); }
}

async function savePersonalProfileOnly(){
 var u=cur(), client=sb(); if(!u || !client || !u._sb_uid) return;
 var full=(document.getElementById('ppName')||{}).value||''; var phone=(document.getElementById('ppTel')||{}).value||''; var linkedin=(document.getElementById('ppLinkedin')||{}).value||'';
 var bits=full.trim().split(/\s+/).filter(Boolean); var nombre=bits[0]||''; var apellido=bits.slice(1).join(' ');
 try{ var res=await client.from('profiles').update({ nombre:nombre, apellido:apellido, telefono:phone, linkedin:linkedin }).eq('id', u._sb_uid); if(res.error) throw res.error; if(u._sb_profile){ u._sb_profile.nombre=nombre; u._sb_profile.apellido=apellido; u._sb_profile.telefono=phone; u._sb_profile.linkedin=linkedin; } u.responsable=full.trim()||u.responsable||u.name; toastMsg('Perfil actualizado.'); renderMyProfile(); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo guardar el perfil','err'); }
}
function patchMyProfile(){
 window.renderMyProfile = async function(){
   var u=cur(); if(!u){ if(typeof openLogin==='function') openLogin('ver tu perfil'); return; }
   var box=document.getElementById('myProfContent'); if(!box) return;
   var companyLabel=hasCompany(u)?((u._sb_company && (u._sb_company.nombre_fantasia||u._sb_company.razon_social))||'Empresa asociada'):'Sin empresa asociada';
   var role=hasCompany(u)?roleLabel(u._sb_member_role):'—';
   box.innerHTML = `
     <div style="text-align:center;margin-bottom:18px">
       <div class="nav-av" style="width:52px;height:52px;font-size:1.2rem;margin:0 auto 8px">${esc(u.init||'US')}</div>
       <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:1.2rem;font-weight:800;text-transform:uppercase">${esc(u.responsable||u.name||'Usuario')}</h2>
       <p style="font-size:.82rem;color:var(--t3)">${esc(u.email||'')}</p>
     </div>
     <div class="ps6-card">
       <div class="ps6-title">Datos personales</div>
       <div class="ps6-grid2">
         <div><label class="fl">Nombre y apellido</label><input id="ppName" value="${esc((u._sb_profile && (((u._sb_profile.nombre||'')+' '+(u._sb_profile.apellido||'')).trim()))||u.responsable||u.name||'')}"></div>
         <div><label class="fl">Teléfono</label><input id="ppTel" value="${esc((u._sb_profile&&u._sb_profile.telefono)||u.telPersonal||'')}"></div>
       </div>
       <div style="margin-top:12px"><label class="fl">LinkedIn</label><input id="ppLinkedin" value="${esc((u._sb_profile&&u._sb_profile.linkedin)||u.linkedin||'')}"></div>
       <div class="ps6-actions"><button class="bt bt-p bt-sm" onclick="window.PS_V6.savePersonalProfileOnly()">Guardar perfil</button></div>
     </div>
     <div class="ps6-card">
       <div class="ps6-title">Empresa asociada</div>
       <div class="ps6-kv"><div class="ps6-k">Empresa</div><div class="ps6-v">${esc(companyLabel)}</div></div>
       <div class="ps6-kv"><div class="ps6-k">Rol</div><div class="ps6-v">${esc(role)}</div></div>
       ${hasCompany(u)?`<div class="ps6-kv"><div class="ps6-k">Estado</div><div class="ps6-v">${pill(u._sb_company_verification_status || (u._sb_company_verified?'verificado':'pendiente'))}</div></div><div class="ps6-actions"><button class="bt bt-s bt-sm" onclick="go('mycompany')">Ir a Mi Empresa</button></div>`:`<div class="ps6-help" style="margin-top:10px">Todavía no tenés una empresa asociada. Podés registrar una nueva empresa desde el onboarding o esperar que una empresa te vincule internamente.</div>`}
     </div>`;
 };
 window.saveMyProfile = savePersonalProfileOnly;
}

async function fetchMyCreateRequests(){ var client=sb(), u=cur(); if(!client || !u || !u._sb_uid) return []; try{ var res=await client.from('company_requests').select('*').eq('requester_user_id', u._sb_uid).order('created_at',{ascending:false}); return res.error?[]:(res.data||[]); }catch(e){ return []; } }
function patchOnboarding(){
 if(!window.PS_ONBOARDING) return;
 window.PS_ONBOARDING.goCatalogForExisting=function(){ toastMsg('La vinculación a una empresa no se hace desde catálogo. Un owner debe asociarte internamente desde Mi Empresa.','info'); };
 window.PS_ONBOARDING.openClaimRequest=function(){ toastMsg('La vinculación a una empresa existente se gestiona solo dentro de la app, desde Mi Empresa, por un owner.','info'); };
 window.PS_ONBOARDING.submitClaimRequest=function(){ toastMsg('Este flujo quedó deshabilitado. La vinculación la gestiona un owner desde Mi Empresa.','warn'); };
 window.PS_ONBOARDING.renderOnboarding=async function(){
   var u=cur(); if(!u || isMaster(u) || hasCompany(u)){ var ov=document.getElementById('psOnbOverlay'); if(ov) ov.classList.remove('v'); return; }
   ensurePages();
   if(!document.getElementById('psOnbOverlay')){ var wrap=document.createElement('div'); wrap.id='psOnbOverlay'; wrap.className='ps-onb-overlay'; wrap.innerHTML='<div class="ps-onb-card"><div class="ps-onb-head"><div class="ps-onb-title">Completá tu acceso empresarial</div><div class="ps-onb-sub" id="psOnbSub"></div></div><div class="ps-onb-body" id="psOnbBody"></div><div class="ps-onb-foot"><button class="bt bt-g" id="psOnbDismiss">Cerrar</button></div></div>'; document.body.appendChild(wrap); document.getElementById('psOnbDismiss').onclick=function(){ wrap.classList.remove('v'); }; }
   var reqs=await fetchMyCreateRequests(); var active=(reqs||[]).find(function(r){ return ['pending','under_review','need_more_info'].indexOf(String(r.status||''))!==-1; }) || null;
   document.getElementById('psOnbSub').innerHTML = active ? 'Tu empresa está en proceso de admisión. Cuando Patagonia Source valide ARCA / documentación, vas a poder operar como empresa.' : 'Tu cuenta es personal. Desde acá podés registrar una nueva empresa o seguir explorando hasta que una empresa te vincule internamente.';
   var body='';
   if(active){ body += '<div class="ps-onb-opt" style="grid-column:1 / -1"><div class="ps-badge">Solicitud activa</div><h4>Empresa en admisión</h4><p>Estado actual: <strong>'+esc(String(active.status||'pending').replaceAll('_',' '))+'</strong><br><span class="ps-muted">La empresa no queda verificada automáticamente. El master user valida ARCA, DDJJ y documentación.</span></p>'+(active.reviewer_notes?'<div class="ps-help">Observación: '+esc(active.reviewer_notes)+'</div>':'')+'</div>'; }
   body += '<div class="ps-onb-opt"><div class="ps-badge">Opción A</div><h4>Registrar empresa</h4><p>Creá una empresa nueva dentro de Patagonia Source. El alta final queda sujeta a validación del master user.</p><button class="bt bt-s" onclick="window.PS_V6.openCompanyWizard()">Registrar nueva empresa</button></div>';
   body += '<div class="ps-onb-opt"><div class="ps-badge">Opción B</div><h4>Esperar vinculación</h4><p>Si ya pertenecés a una empresa cargada, un owner debe vincularte desde Mi Empresa. Cuando vuelvas a entrar, la asociación se reflejará automáticamente.</p><button class="bt bt-p" onclick="document.getElementById(\'psOnbOverlay\').classList.remove(\'v\')">Entendido</button></div>';
   body += '<div class="ps-onb-opt"><div class="ps-badge">Opción C</div><h4>Seguir como viewer</h4><p>Podés recorrer el catálogo y perfiles públicos mientras tanto. Los eventos quedan reservados para empresas verificadas o master users.</p><button class="bt bt-g" onclick="document.getElementById(\'psOnbOverlay\').classList.remove(\'v\')">Explorar por ahora</button></div>';
   document.getElementById('psOnbBody').innerHTML=body; document.getElementById('psOnbOverlay').classList.add('v');
 };
}

async function fetchCompany(companyId){ var client=sb(); if(!client || !companyId) return null; try{ var res=await client.from('companies').select('*').eq('id', companyId).single(); return res.error?null:res.data; }catch(e){ return null; } }
async function fetchMembers(companyId){ var client=sb(); if(!client || !companyId) return []; try{ var res=await client.from('company_members').select('user_id, role, cargo, area, profiles(id,email,nombre,apellido,telefono)').eq('company_id', companyId).order('created_at'); return res.error?[]:(res.data||[]); }catch(e){ return []; } }
async function fetchCerts(companyId){ var client=sb(); if(!client || !companyId) return []; try{ var res=await client.from('company_certifications').select('*').eq('company_id', companyId).order('created_at'); return res.error?[]:(res.data||[]); }catch(e){ return []; } }

async function linkUserDirect(){
 var client=sb(), u=cur(); if(!client || !u || !u._sb_company_id || !isOwner(u)) return;
 var email=((document.getElementById('ps6LinkEmail')||{}).value||'').trim().toLowerCase();
 var role=((document.getElementById('ps6LinkRole')||{}).value||'member').trim();
 var cargo=((document.getElementById('ps6LinkCargo')||{}).value||'').trim();
 var area=((document.getElementById('ps6LinkArea')||{}).value||'').trim();
 if(!email){ toastMsg('Ingresá el mail del usuario.','warn'); return; }
 try{
   var prof=await client.from('profiles').select('id,email,nombre,apellido').eq('email', email).single();
   if(prof.error || !prof.data || !prof.data.id){ toastMsg('Ese usuario todavía no existe en la app. Primero debe registrarse como persona.','warn'); return; }
   if(prof.data.id===u._sb_uid){ toastMsg('Ese usuario ya es el owner actual.','warn'); return; }
   var row={ company_id:u._sb_company_id, user_id:prof.data.id, role:role, cargo:cargo||null, area:area||null };
   var up=await client.from('company_members').upsert(row,{ onConflict:'company_id,user_id' }).select();
   if(up.error) throw up.error;
   toastMsg('Usuario vinculado a la empresa. En su próximo login ya verá la empresa asociada con el rol asignado.');
   await renderMyCompany();
 }catch(e){ console.error(e); toastMsg(e.message||'No se pudo vincular el usuario','err'); }
}
async function removeMember(userId){
 var client=sb(), u=cur(); if(!client || !u || !u._sb_company_id || !isOwner(u)) return;
 if(!confirm('¿Quitar este usuario de la empresa?')) return;
 try{ var del=await client.from('company_members').delete().eq('company_id', u._sb_company_id).eq('user_id', userId); if(del.error) throw del.error; toastMsg('Usuario removido.'); await renderMyCompany(); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo quitar el usuario','err'); }
}

function docRow(label, status, openBtn, actionBtn){
 return `<div class="ps6-doc"><div class="ps6-inline" style="justify-content:space-between"><div><div style="font-weight:700">${label}</div><div class="ps6-help">${status}</div></div><div class="ps6-inline">${openBtn||''}${actionBtn||''}</div></div></div>`;
}
function docsCard(comp, certs, u){
 var certMap={}; (certs||[]).forEach(function(c){ certMap[c.cert_type]=c; });
 function certStatus(c){ if(!c) return 'Sin cargar'; var s=String(c.status||'pending').replaceAll('_',' '); if(verifiedStatus(c.status) && c.expires_at) s += ' · Válido hasta ' + dateStr(c.expires_at); if(verifiedStatus(c.status)) s += ' · Sello liberado'; return s; }
 function openBtn(path){ return path ? `<button class="bt bt-s bt-sm" onclick="window.PS_CERTS.openStoredCert('${String(path).replace(/'/g,"\\'")}')">Abrir</button>` : ''; }
 function loadBtn(kind){ return canManageDocs(u) ? `<button class="bt bt-g bt-sm" onclick="window.PS_V6.openDocUploader('${kind}')">Cargar</button>` : ''; }
 var html = `<div class="ps6-card"><div class="ps6-title">Documentación y certificaciones</div><div class="ps6-banner"><strong>Regla de admisión:</strong> crear una empresa no la deja verificada. Patagonia Source valida constancia ARCA / CUIT, DDJJ y documentación. Cada certificado aprobado libera su sello correspondiente.</div><div class="ps6-kv"><div class="ps6-k">Estado de la empresa</div><div class="ps6-v">${pill(comp.verification_status || 'pendiente')}</div></div><div class="ps6-kv"><div class="ps6-k">ARCA / CUIT</div><div class="ps6-v">${comp.cuit_constancia_at ? 'Cargado el ' + dateStr(comp.cuit_constancia_at) : 'Pendiente (obligatorio)'}</div></div><div class="ps6-kv"><div class="ps6-k">DDJJ</div><div class="ps6-v">${comp.ddjj_accepted_at ? 'Aceptada el ' + dateStr(comp.ddjj_accepted_at) : 'Pendiente'}</div></div>`;
 html += docRow('Constancia ARCA / CUIT *', comp.cuit_constancia_at ? ('Cargada el ' + dateStr(comp.cuit_constancia_at)) : 'Pendiente (obligatoria)', openBtn(comp.cuit_constancia_url), loadBtn('arca'));
 html += docRow('Declaración jurada', comp.ddjj_accepted_at ? ('Aceptada el ' + dateStr(comp.ddjj_accepted_at)) : 'Pendiente', '', (canManageDocs(u) && !comp.ddjj_accepted_at) ? '<button class="bt bt-p bt-sm" onclick="window.PS_V6.openDdjjModal()">Aceptar DDJJ</button>' : '');
 [['pnc','PNC (Compre Neuquino)'],['iso_9001','ISO 9001'],['iso_14001','ISO 14001'],['iso_45001','ISO 45001']].forEach(function(it){ var c=certMap[it[0]]||null; html += docRow(it[1], certStatus(c), openBtn(c&&c.file_url), loadBtn(it[0])); });
 html += `</div>`;
 return html;
}

function companyCard(comp, members, certs, u){
 var companyName=comp.nombre_fantasia || comp.razon_social || 'Empresa';
 var empRange=comp.empleados_aprox || '';
 var cls=comp.clasificacion || classifyRangeLabel(empRange);
 return `
  <div class="ps6-banner"><strong>Estado de admisión:</strong> ${isVerifiedCompany(u) ? 'La empresa ya está verificada y puede operar con normalidad.' : 'La empresa existe pero sigue pendiente de verificación Patagonia Source. Se requiere constancia ARCA / CUIT y revisión master.'}</div>
  <div class="ps6-card">
    <div class="ps6-title">Mi Empresa</div>
    <div class="ps6-kv"><div class="ps6-k">Empresa</div><div class="ps6-v">${esc(companyName)}</div></div>
    <div class="ps6-kv"><div class="ps6-k">Rol actual</div><div class="ps6-v">${esc(roleLabel(memberRole(u)))}</div></div>
    <div class="ps6-kv"><div class="ps6-k">Estado</div><div class="ps6-v">${pill(comp.verification_status || (u._sb_company_verified ? 'verificado':'pendiente'))}</div></div>
    <div class="ps6-grid3" style="margin-top:12px">
      <div><label class="fl">Razón social</label><input id="ps6RS" value="${esc(comp.razon_social||companyName)}" ${isOwner(u)?'':'disabled'}></div>
      <div><label class="fl">CUIT</label><input id="ps6CUIT" value="${esc(comp.cuit||'')}" ${isOwner(u)?'':'disabled'}></div>
      <div><label class="fl">Tipo societario</label><input id="ps6Tipo" value="${esc(comp.tipo_societario||'')}" ${isOwner(u)?'':'disabled'}></div>
    </div>
    <div class="ps6-grid3" style="margin-top:12px">
      <div><label class="fl">Rubro principal</label><input id="ps6Rubro" value="${esc(comp.rubro_principal||'')}" ${isOwner(u)?'':'disabled'}></div>
      <div><label class="fl">Empleados</label><select id="ps6EmpRange" ${isOwner(u)?'':'disabled'}><option value="">Seleccionar...</option><option value="1-10" ${empRange==='1-10'?'selected':''}>1–10</option><option value="11-50" ${empRange==='11-50'?'selected':''}>11–50</option><option value="51-250" ${empRange==='51-250'?'selected':''}>51–250</option><option value="+250" ${empRange==='+250'?'selected':''}>+250</option></select></div>
      <div><label class="fl">Clasificación</label><input id="ps6Class" value="${esc(cls)}" disabled></div>
    </div>
    <div class="ps6-grid2" style="margin-top:12px">
      <div><label class="fl">Email empresa</label><input id="ps6Mail" value="${esc(comp.email_empresa||'')}" ${isOwner(u)?'':'disabled'}></div>
      <div><label class="fl">Teléfono empresa</label><input id="ps6Tel" value="${esc(comp.telefono_empresa||'')}" ${isOwner(u)?'':'disabled'}></div>
    </div>
    <div class="ps6-grid2" style="margin-top:12px">
      <div><label class="fl">Sede central</label><input id="ps6Sede" value="${esc(comp.sede_central||'')}" ${isOwner(u)?'':'disabled'}></div>
      <div><label class="fl">Bases operativas</label><input id="ps6Bases" value="${esc((comp.bases_operativas||[]).join(', '))}" ${isOwner(u)?'':'disabled'}></div>
    </div>
    <div style="margin-top:12px"><label class="fl">Sitio web</label><input id="ps6Web" value="${esc(comp.sitio_web||'')}" ${isOwner(u)?'':'disabled'}></div>
    <div style="margin-top:12px"><label class="fl">Descripción</label><textarea id="ps6Desc" rows="3" ${isOwner(u)?'':'disabled'}>${esc(comp.descripcion||'')}</textarea></div>
    ${isOwner(u)?'<div class="ps6-actions"><button class="bt bt-p bt-sm" onclick="window.PS_V6.saveCompanyCore()">Guardar empresa</button></div>':''}
  </div>
  ${docsCard(comp, certs, u)}
  <div class="ps6-card">
    <div class="ps6-title">Usuarios vinculados y roles</div>
    <div class="ps6-help">La vinculación se maneja directamente dentro de la app. El owner asocia usuarios ya registrados y les asigna rol/cargo. Cuando ese usuario vuelva a entrar, la empresa quedará asociada automáticamente.</div>
    <div style="margin-top:12px">${members.length ? members.map(function(m){ var p=m.profiles||{}; var nm=((p.nombre||'')+' '+(p.apellido||'')).trim() || p.email || 'Usuario'; return `<div class="ps6-user"><div class="ps6-inline" style="justify-content:space-between"><div><div style="font-weight:700">${esc(nm)}</div><div class="ps6-help">${esc(p.email||'')}</div></div><div class="ps6-inline"><span>${esc(roleLabel(m.role))}${m.cargo?(' · '+esc(m.cargo)):''}</span>${isOwner(u)&&m.role!=='owner'?`<button class="bt bt-d bt-sm" onclick="window.PS_V6.removeMember('${m.user_id}')">Quitar</button>`:''}</div></div></div>`; }).join('') : '<div class="ps6-help">No hay usuarios vinculados todavía.</div>'}</div>
    ${isOwner(u)?`<div style="margin-top:14px;border-top:1px solid var(--brd);padding-top:14px"><div class="ps6-title" style="font-size:.95rem">Vincular usuario existente</div><div class="ps6-grid3"><div><label class="fl">Mail del usuario</label><input id="ps6LinkEmail" type="email" placeholder="usuario@dominio.com"></div><div><label class="fl">Rol interno</label><select id="ps6LinkRole"><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select></div><div><label class="fl">Cargo</label><input id="ps6LinkCargo" placeholder="Ej: Compras, Comercial"></div></div><div class="ps6-grid2" style="margin-top:12px"><div><label class="fl">Área</label><input id="ps6LinkArea" placeholder="Ej: Abastecimiento"></div><div style="display:flex;align-items:end;justify-content:flex-end"><button class="bt bt-p" onclick="window.PS_V6.linkUserDirect()">Vincular usuario</button></div></div></div>`:''}
  </div>`;
}

async function renderMyCompany(){
 var u=cur(); ensurePages(); syncNav(); var box=document.getElementById('myCompanyContent'); if(!box) return;
 if(!u){ box.innerHTML='<div class="ps6-card"><div class="ps6-title">Mi Empresa</div><div class="ps6-help">Iniciá sesión para acceder.</div></div>'; return; }
 if(!hasCompany(u)){ box.innerHTML='<div class="ps6-card"><div class="ps6-title">Mi Empresa</div><div class="ps6-help">Todavía no tenés una empresa asociada. Desde el onboarding podés registrar una nueva empresa. Si pertenecés a una empresa existente, un owner debe vincularte directamente dentro de la app.</div><div class="ps6-actions" style="justify-content:flex-start"><button class="bt bt-p bt-sm" onclick="window.PS_ONBOARDING && window.PS_ONBOARDING.renderOnboarding && window.PS_ONBOARDING.renderOnboarding(true)">Completar onboarding</button></div></div>'; return; }
 box.innerHTML='<div class="ps6-card"><div class="ps6-title">Mi Empresa</div><div class="ps6-help">Cargando...</div></div>';
 try{ var comp=await fetchCompany(u._sb_company_id) || u._sb_company || {}; var members=await fetchMembers(u._sb_company_id); var certs=await fetchCerts(u._sb_company_id); u._sb_company=comp; u._sb_company_verification_status = comp.verification_status || (u._sb_company_verified?'verificado':'pendiente'); u._sb_company_verified = verifiedStatus(u._sb_company_verification_status) || !!comp.is_verified; box.innerHTML=companyCard(comp,members,certs,u); var sel=document.getElementById('ps6EmpRange'); if(sel){ sel.onchange=function(){ var cls=document.getElementById('ps6Class'); if(cls) cls.value=classifyRangeLabel(sel.value); }; } }catch(e){ console.error(e); box.innerHTML='<div class="ps6-card"><div class="ps6-title">Mi Empresa</div><div class="ps6-help">No se pudo cargar la empresa.</div></div>'; }
}

async function saveCompanyCore(){ var client=sb(), u=cur(); if(!client || !u || !u._sb_company_id || !isOwner(u)) return; var payload={ razon_social:(document.getElementById('ps6RS')||{}).value||'', cuit:(document.getElementById('ps6CUIT')||{}).value||'', tipo_societario:(document.getElementById('ps6Tipo')||{}).value||'', rubro_principal:(document.getElementById('ps6Rubro')||{}).value||'', empleados_aprox:(document.getElementById('ps6EmpRange')||{}).value||null, clasificacion:(document.getElementById('ps6Class')||{}).value||null, email_empresa:(document.getElementById('ps6Mail')||{}).value||'', telefono_empresa:(document.getElementById('ps6Tel')||{}).value||'', sede_central:(document.getElementById('ps6Sede')||{}).value||'', bases_operativas:((document.getElementById('ps6Bases')||{}).value||'').split(',').map(function(v){return v.trim();}).filter(Boolean), sitio_web:(document.getElementById('ps6Web')||{}).value||'', descripcion:(document.getElementById('ps6Desc')||{}).value||'' };
 try{ var res=await client.from('companies').update(payload).eq('id', u._sb_company_id); if(res.error) throw res.error; toastMsg('Empresa actualizada.'); await renderMyCompany(); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo guardar la empresa','err'); }
}

var WZ={step:1,data:{users:[]},files:{}};
function resetWizard(){ WZ={step:1,data:{users:[]},files:{}}; }
function stepBar(step){ var labels=['1/4 Datos generales','2/4 Documentación','3/4 Usuarios y roles','4/4 Declaración jurada']; return '<div class="ps6-stepbar">'+labels.map(function(lbl,idx){ return `<div class="ps6-stepitem"><div class="lbl">${lbl}</div><div class="bar"><span style="width:${idx < step ? '100%' : idx===step-1 ? '100%' : '0%'}"></span></div></div>`; }).join('')+'</div>'; }
function wizardShell(title, body){ return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px"><div><div class="ps-onb-title" style="font-size:1.25rem">${title}</div><div class="ps-onb-sub">Formulario simple. Al finalizar se lanza la aprobación y la empresa queda creada pero sin verificado Patagonia Source.</div></div><button class="bt bt-g bt-sm" onclick="window.PS_V6.closeSheet()">Cerrar</button></div>${stepBar(WZ.step)}${body}`; }
function syncWizardClass(){ var sel=document.getElementById('wzEmp'); var cls=document.getElementById('wzClass'); if(sel && cls) cls.value=classifyRangeLabel(sel.value); }
function addWizardUser(){ WZ.data.users.push({email:'',role:'member',cargo:'',area:''}); renderWizard(); }
function removeWizardUser(i){ WZ.data.users.splice(i,1); renderWizard(); }
function updateWizardUser(i, field, value){ if(!WZ.data.users[i]) return; WZ.data.users[i][field]=value; }
function renderWizard(){
 ensurePages();
 var html='';
 if(WZ.step===1){
   html = wizardShell('Registro de empresa', `
     <div class="ps6-grid2">
       <div><label class="fl">Razón social <span class="rq">*</span></label><input id="wzRS" value="${esc(WZ.data.razon_social||'')}"></div>
       <div><label class="fl">CUIT <span class="rq">*</span></label><input id="wzCUIT" value="${esc(WZ.data.cuit||'')}" placeholder="30-12345678-9"></div>
     </div>
     <div class="ps6-grid3" style="margin-top:12px">
       <div><label class="fl">Tipo societario <span class="rq">*</span></label><select id="wzTipo"><option value="">Seleccionar...</option>${['SRL','SA','SAS','Monotributo','Resp. Inscripto','UTE','Cooperativa','Otro'].map(v=>`<option ${WZ.data.tipo_societario===v?'selected':''}>${v}</option>`).join('')}</select></div>
       <div><label class="fl">Rubro principal <span class="rq">*</span></label><input id="wzRubro" value="${esc(WZ.data.rubro_principal||'')}" placeholder="Ej: Automatización, Transporte Especial"></div>
       <div><label class="fl">Empleados <span class="rq">*</span></label><select id="wzEmp" onchange="window.PS_V6.syncWizardClass()"><option value="">Seleccionar...</option><option value="1-10" ${WZ.data.empleados_aprox==='1-10'?'selected':''}>1–10</option><option value="11-50" ${WZ.data.empleados_aprox==='11-50'?'selected':''}>11–50</option><option value="51-250" ${WZ.data.empleados_aprox==='51-250'?'selected':''}>51–250</option><option value="+250" ${WZ.data.empleados_aprox==='+250'?'selected':''}>+250</option></select></div>
     </div>
     <div class="ps6-grid3" style="margin-top:12px">
       <div><label class="fl">Clasificación</label><input id="wzClass" value="${esc(WZ.data.clasificacion||classifyRangeLabel(WZ.data.empleados_aprox||''))}" disabled></div>
       <div><label class="fl">Email empresa <span class="rq">*</span></label><input id="wzMail" type="email" value="${esc(WZ.data.email_empresa||'')}"></div>
       <div><label class="fl">Teléfono empresa</label><input id="wzTel" value="${esc(WZ.data.telefono_empresa||'')}"></div>
     </div>
     <div class="ps6-grid2" style="margin-top:12px">
       <div><label class="fl">Sede central <span class="rq">*</span></label><input id="wzSede" value="${esc(WZ.data.sede_central||'')}"></div>
       <div><label class="fl">Bases operativas</label><input id="wzBases" value="${esc((WZ.data.bases_operativas||[]).join(', '))}" placeholder="Separar con coma"></div>
     </div>
     <div style="margin-top:12px"><label class="fl">Sitio web</label><input id="wzWeb" value="${esc(WZ.data.sitio_web||'')}"></div>
     <div style="margin-top:12px"><label class="fl">Descripción breve</label><textarea id="wzDesc" rows="3">${esc(WZ.data.descripcion||'')}</textarea></div>
     <div class="ps6-actions"><button class="bt bt-p" onclick="window.PS_V6.nextWizardStep()">Siguiente</button></div>`);
 }
 if(WZ.step===2){
   html = wizardShell('Registro de empresa', `
     <div class="ps6-banner"><strong>Obligatorio:</strong> la constancia de CUIT / CUIL emitida por ARCA es condición necesaria para que Patagonia Source pueda verificar la existencia de la empresa.</div>
     <div class="ps6-doc"><div style="font-weight:700">Constancia ARCA / CUIT <span style="color:var(--ac)">*</span></div><div class="ps6-help">Adjuntá PDF, JPG o PNG. Sin este archivo no se puede finalizar el registro.</div><div style="margin-top:10px"><input type="file" id="wzArca" accept=".pdf,.jpg,.jpeg,.png"></div></div>
     <div class="ps6-doc"><div style="font-weight:700">PNC (opcional)</div><div class="ps6-help">Si tu empresa cuenta con constancia PNC, podés cargarla ahora o después.</div><div style="margin-top:10px"><input type="file" id="wzPnc" accept=".pdf,.jpg,.jpeg,.png"></div></div>
     <div class="ps6-doc"><div style="font-weight:700">ISO 9001 / 14001 / 45001 (opcionales)</div><div class="ps6-help">Podés cargar los certificados ahora o hacerlo luego desde Mi Empresa.</div><div class="ps6-grid3" style="margin-top:10px"><div><label class="fl">ISO 9001</label><input type="file" id="wzIso9001" accept=".pdf,.jpg,.jpeg,.png"></div><div><label class="fl">ISO 14001</label><input type="file" id="wzIso14001" accept=".pdf,.jpg,.jpeg,.png"></div><div><label class="fl">ISO 45001</label><input type="file" id="wzIso45001" accept=".pdf,.jpg,.jpeg,.png"></div></div></div>
     <div class="ps6-actions"><button class="bt bt-g" onclick="window.PS_V6.prevWizardStep()">Volver</button><button class="bt bt-p" onclick="window.PS_V6.nextWizardStep()">Siguiente</button></div>`);
 }
 if(WZ.step===3){
   html = wizardShell('Registro de empresa', `
     <div class="ps6-banner">El usuario que registra la empresa queda como <strong>Owner</strong>. Si querés, podés dejar predefinidos otros usuarios para vincular cuando ya estén registrados en la app.</div>
     <div class="ps6-grid2"><div><label class="fl">Owner actual</label><input value="${esc((cur()&&cur().email)||'') }" disabled></div><div><label class="fl">Cargo del solicitante <span class="rq">*</span></label><input id="wzOwnerCargo" value="${esc(WZ.data.owner_cargo||'')}" placeholder="Ej: Responsable Comercial"></div></div>
     <div style="margin-top:14px"><div class="ps6-title" style="font-size:.95rem">Usuarios a vincular (opcional)</div>${(WZ.data.users||[]).map(function(us,i){ return `<div class="ps6-user"><div class="ps6-grid3"><div><label class="fl">Mail</label><input value="${esc(us.email||'')}" oninput="window.PS_V6.updateWizardUser(${i},'email',this.value)"></div><div><label class="fl">Rol</label><select onchange="window.PS_V6.updateWizardUser(${i},'role',this.value)"><option value="admin" ${us.role==='admin'?'selected':''}>Admin</option><option value="member" ${us.role==='member'?'selected':''}>Member</option><option value="viewer" ${us.role==='viewer'?'selected':''}>Viewer</option></select></div><div><label class="fl">Cargo</label><input value="${esc(us.cargo||'')}" oninput="window.PS_V6.updateWizardUser(${i},'cargo',this.value)"></div></div><div class="ps6-grid2" style="margin-top:12px"><div><label class="fl">Área</label><input value="${esc(us.area||'')}" oninput="window.PS_V6.updateWizardUser(${i},'area',this.value)"></div><div style="display:flex;align-items:end;justify-content:flex-end"><button class="bt bt-d bt-sm" onclick="window.PS_V6.removeWizardUser(${i})">Quitar</button></div></div></div>`; }).join('') || '<div class="ps6-help">No agregaste usuarios extra.</div>'}</div>
     <div class="ps6-actions" style="justify-content:space-between"><button class="bt bt-s bt-sm" onclick="window.PS_V6.addWizardUser()">+ Agregar usuario</button><div style="display:flex;gap:8px"><button class="bt bt-g" onclick="window.PS_V6.prevWizardStep()">Volver</button><button class="bt bt-p" onclick="window.PS_V6.nextWizardStep()">Siguiente</button></div></div>`);
 }
 if(WZ.step===4){
   html = wizardShell('Registro de empresa', `
     <div class="ps6-banner"><strong>Declaración jurada:</strong> declaro que la información cargada es fiel y actualizada, que la empresa cumple con sus obligaciones legales aplicables, y que Patagonia Source podrá solicitar evidencia adicional para validar datos, seguros y documentación.</div>
     <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:.84rem"><input type="checkbox" id="wzDdjj"> Acepto la declaración jurada y autorizo la revisión documental por parte de Patagonia Source.</label>
     <div class="ps6-actions"><button class="bt bt-g" onclick="window.PS_V6.prevWizardStep()">Volver</button><button class="bt bt-p" onclick="window.PS_V6.submitCompanyWizard()">Finalizar y lanzar aprobación</button></div>`);
 }
 openSheet(html);
}
function nextWizardStep(){
 if(WZ.step===1){
   WZ.data.razon_social=(document.getElementById('wzRS')||{}).value||'';
   WZ.data.cuit=(document.getElementById('wzCUIT')||{}).value||'';
   WZ.data.tipo_societario=(document.getElementById('wzTipo')||{}).value||'';
   WZ.data.rubro_principal=(document.getElementById('wzRubro')||{}).value||'';
   WZ.data.empleados_aprox=(document.getElementById('wzEmp')||{}).value||'';
   WZ.data.clasificacion=(document.getElementById('wzClass')||{}).value||'';
   WZ.data.email_empresa=(document.getElementById('wzMail')||{}).value||'';
   WZ.data.telefono_empresa=(document.getElementById('wzTel')||{}).value||'';
   WZ.data.sede_central=(document.getElementById('wzSede')||{}).value||'';
   WZ.data.bases_operativas=((document.getElementById('wzBases')||{}).value||'').split(',').map(function(v){return v.trim();}).filter(Boolean);
   WZ.data.sitio_web=(document.getElementById('wzWeb')||{}).value||'';
   WZ.data.descripcion=(document.getElementById('wzDesc')||{}).value||'';
   if(!WZ.data.razon_social || !WZ.data.cuit || !WZ.data.tipo_societario || !WZ.data.rubro_principal || !WZ.data.empleados_aprox || !WZ.data.email_empresa || !WZ.data.sede_central){ toastMsg('Completá todos los campos obligatorios del paso 1.','warn'); return; }
 }
 if(WZ.step===2){
   var f=(document.getElementById('wzArca')||{}).files; if(!f || !f[0]){ toastMsg('La constancia ARCA / CUIT es obligatoria.','warn'); return; }
 }
 if(WZ.step===3){ WZ.data.owner_cargo=(document.getElementById('wzOwnerCargo')||{}).value||''; if(!WZ.data.owner_cargo){ toastMsg('Completá el cargo del solicitante.','warn'); return; } }
 WZ.step = Math.min(4, WZ.step+1); renderWizard();
}
function prevWizardStep(){ WZ.step=Math.max(1,WZ.step-1); renderWizard(); }
async function uploadAttachment(requestId, file, label){
 var client=sb(); if(!client || !file) return null;
 var safe=(Date.now()+'-'+String(file.name||label||'archivo')).replace(/[^a-zA-Z0-9._-]/g,'_');
 var path='company-requests/'+requestId+'/'+safe;
 var up=await client.storage.from('attachments').upload(path, file, { upsert:true });
 if(up.error) throw up.error;
 return { kind:label||'file', path:path, name:file.name||safe, size:file.size||0, uploaded_at:new Date().toISOString() };
}
async function submitCompanyWizard(){
 var client=sb(), u=cur(); if(!client || !u || !u._sb_uid) return;
 if(!(document.getElementById('wzDdjj')||{}).checked){ toastMsg('Debés aceptar la declaración jurada para finalizar.','warn'); return; }
 try{
   var payload={ razon_social:WZ.data.razon_social, cuit:WZ.data.cuit, tipo_societario:WZ.data.tipo_societario, rubro_principal:WZ.data.rubro_principal, email_empresa:WZ.data.email_empresa, telefono_empresa:WZ.data.telefono_empresa, sede_central:WZ.data.sede_central, bases_operativas:WZ.data.bases_operativas||[], sitio_web:WZ.data.sitio_web||'', descripcion:WZ.data.descripcion||'', empleados_aprox:WZ.data.empleados_aprox, clasificacion:WZ.data.clasificacion||classifyRangeLabel(WZ.data.empleados_aprox||''), owner_cargo:WZ.data.owner_cargo||'', prelinked_users:WZ.data.users||[], pnc:{ enabled: !!((document.getElementById('wzPnc')||{}).files||[])[0] }, iso_9001:{ enabled: !!((document.getElementById('wzIso9001')||{}).files||[])[0] }, iso_14001:{ enabled: !!((document.getElementById('wzIso14001')||{}).files||[])[0] }, iso_45001:{ enabled: !!((document.getElementById('wzIso45001')||{}).files||[])[0] } };
   var ins=await client.from('company_requests').insert({ requester_user_id:u._sb_uid, request_type:'create_new', assigned_role:'owner', request_payload:payload, requester_message:'Registro inicial de empresa', requester_phone:(u._sb_profile && u._sb_profile.telefono) || u.telPersonal || '' }).select('*').single();
   if(ins.error) throw ins.error;
   var attachments=[];
   attachments.push(await uploadAttachment(ins.data.id, (document.getElementById('wzArca')||{}).files[0], 'arca'));
   var pncFile=((document.getElementById('wzPnc')||{}).files||[])[0]; if(pncFile) attachments.push(await uploadAttachment(ins.data.id, pncFile, 'pnc'));
   var i1=((document.getElementById('wzIso9001')||{}).files||[])[0]; if(i1) attachments.push(await uploadAttachment(ins.data.id, i1, 'iso_9001'));
   var i2=((document.getElementById('wzIso14001')||{}).files||[])[0]; if(i2) attachments.push(await uploadAttachment(ins.data.id, i2, 'iso_14001'));
   var i3=((document.getElementById('wzIso45001')||{}).files||[])[0]; if(i3) attachments.push(await uploadAttachment(ins.data.id, i3, 'iso_45001'));
   var upd=await client.rpc('update_company_request_submission', { p_request_id:ins.data.id, p_assigned_role:'owner', p_request_payload:payload, p_requester_message:'Registro inicial de empresa', p_requester_phone:(u._sb_profile && u._sb_profile.telefono) || u.telPersonal || '', p_attachments:attachments });
   if(upd.error){
     var fb=await client.from('company_requests').update({ request_payload:payload, attachments:attachments, requester_message:'Registro inicial de empresa' }).eq('id', ins.data.id); if(fb.error) throw fb.error;
   }
   closeSheet();
   var ov=document.getElementById('psOnbOverlay'); if(ov) ov.classList.remove('v');
   toastMsg('Empresa creada y enviada a aprobación. Queda pendiente de verificación Patagonia Source.','ok');
   if(window.PS_ONBOARDING && window.PS_ONBOARDING.renderOnboarding) setTimeout(function(){ window.PS_ONBOARDING.renderOnboarding(true); }, 200);
 }catch(e){ console.error(e); toastMsg(e.message || 'No se pudo registrar la empresa', 'err'); }
}
function openCompanyWizard(){ resetWizard(); renderWizard(); }

function openDocUploader(kind){
 var title = kind==='arca' ? 'Constancia ARCA / CUIT' : (kind==='pnc' ? 'PNC (Compre Neuquino)' : kind.toUpperCase().replace('_',' '));
 var extra = kind==='arca' ? '<div class="ps6-help" style="margin-top:8px">Archivo obligatorio para la validación final de la empresa.</div>' : '';
 var body = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px"><div><div class="ps-onb-title" style="font-size:1.2rem">${title}</div><div class="ps-onb-sub">Cargá el documento para revisión manual de Patagonia Source.</div></div><button class="bt bt-g bt-sm" onclick="window.PS_V6.closeSheet()">Cerrar</button></div><div><input type="file" id="pscUploadFile" accept=".pdf,.jpg,.jpeg,.png"></div>${extra}`;
 if(kind==='arca') body += `<div class="ps6-actions"><button class="bt bt-g" onclick="window.PS_V6.closeSheet()">Cancelar</button><button class="bt bt-p" onclick="window.PS_V6.commitArcaUpload()">Subir</button></div>`;
 else if(kind==='pnc') body += `<div class="ps6-actions"><button class="bt bt-g" onclick="window.PS_V6.closeSheet()">Cancelar</button><button class="bt bt-p" onclick="window.PS_V6.commitCertUpload('pnc')">Enviar</button></div>`;
 else body += `<div class="ps6-grid2" style="margin-top:12px"><div><label class="fl">Emisor / organismo</label><input id="pscIssuer"></div><div><label class="fl">Nº certificado</label><input id="pscNum"></div></div><div class="ps6-grid2" style="margin-top:12px"><div><label class="fl">Fecha emisión</label><input type="date" id="pscFrom"></div><div><label class="fl">Fecha vencimiento</label><input type="date" id="pscTo"></div></div><div style="margin-top:12px"><label class="fl">Alcance</label><input id="pscScope"></div><div class="ps6-actions"><button class="bt bt-g" onclick="window.PS_V6.closeSheet()">Cancelar</button><button class="bt bt-p" onclick="window.PS_V6.commitCertUpload('${kind}')">Enviar</button></div>`;
 openSheet(body);
}
async function commitArcaUpload(){
 var client=sb(), u=cur(); if(!client || !u || !u._sb_company_id) return; var f=((document.getElementById('pscUploadFile')||{}).files||[])[0]; if(!f){ toastMsg('Seleccioná un archivo.','warn'); return; }
 try{ var ext=f.name.includes('.') ? f.name.substring(f.name.lastIndexOf('.')) : '.pdf'; var path=u._sb_company_id + '/cuit_constancia' + ext; var up=await client.storage.from('certificates').upload(path, f, { upsert:true }); if(up.error) throw up.error; var rpc=await client.rpc('upload_cuit_constancia', { p_company_id:u._sb_company_id, p_file_url:path }); if(rpc.error) throw rpc.error; closeSheet(); toastMsg('Constancia ARCA / CUIT cargada.'); await renderMyCompany(); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo subir la constancia', 'err'); }
}
async function commitCertUpload(kind){
 var client=sb(), u=cur(); if(!client || !u || !u._sb_company_id) return; var f=((document.getElementById('pscUploadFile')||{}).files||[])[0]; if(!f){ toastMsg('Seleccioná un archivo.','warn'); return; }
 try{ var ext=f.name.includes('.') ? f.name.substring(f.name.lastIndexOf('.')) : '.pdf'; var path=u._sb_company_id + '/' + kind + ext; var up=await client.storage.from('certificates').upload(path, f, { upsert:true }); if(up.error) throw up.error; var row={ company_id:u._sb_company_id, cert_type:kind, file_url:path, file_name:f.name, status:'pending', issuer:null, cert_number:null, scope:null, issued_at:null, expires_at:null, reviewer_id:null, reviewer_notes:null, reviewed_at:null, reminder_sent_at:null };
   if(kind.indexOf('iso_')===0){ row.issuer=(document.getElementById('pscIssuer')||{}).value||null; row.cert_number=(document.getElementById('pscNum')||{}).value||null; row.scope=(document.getElementById('pscScope')||{}).value||null; row.issued_at=(document.getElementById('pscFrom')||{}).value||null; row.expires_at=(document.getElementById('pscTo')||{}).value||null; }
   var res=await client.from('company_certifications').upsert(row, { onConflict:'company_id,cert_type' }).select(); if(res.error) throw res.error; closeSheet(); toastMsg('Documento enviado para revisión.'); await renderMyCompany();
 }catch(e){ console.error(e); toastMsg(e.message||'No se pudo subir el certificado', 'err'); }
}
async function acceptDdjj(){
 var client=sb(), u=cur(); if(!client || !u || !u._sb_company_id) return;
 try{ var rpc=await client.rpc('accept_ddjj', { p_company_id:u._sb_company_id, p_ip:null }); if(rpc.error) throw rpc.error; closeSheet(); toastMsg('Declaración jurada aceptada.'); await renderMyCompany(); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo registrar la DDJJ', 'err'); }
}
function openDdjjModal(){ openSheet(`<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px"><div><div class="ps-onb-title" style="font-size:1.2rem">Declaración jurada</div><div class="ps-onb-sub">Confirmá la declaración jurada de la empresa.</div></div><button class="bt bt-g bt-sm" onclick="window.PS_V6.closeSheet()">Cerrar</button></div><div class="sworn"><div class="sworn-title">DECLARACIÓN JURADA</div><div class="sworn-text">Declaro que la información y documentos aportados son veraces y vigentes. Declaro, además, que cumplo con las obligaciones legales que resulten aplicables a mi actividad, incluidos seguros y documentación respaldatoria, y acepto que Patagonia Source podrá solicitar evidencia adicional o suspender el perfil si detecta inconsistencias.</div></div><div class="ps6-actions"><button class="bt bt-g" onclick="window.PS_V6.closeSheet()">Cancelar</button><button class="bt bt-p" onclick="window.PS_V6.acceptDdjj()">Confirmar DDJJ</button></div>`); }

function boot(){ ensurePages(); patchNavigation(); patchRegisterPage(); patchMyProfile(); patchOnboarding(); syncNav(); setInterval(syncNav,1200); console.log('[PS v6] activo'); }
window.PS_V6={ closeSheet:closeSheet, savePersonalProfileOnly:savePersonalProfileOnly, renderMyCompany:renderMyCompany, saveCompanyCore:saveCompanyCore, linkUserDirect:linkUserDirect, removeMember:removeMember, openCompanyWizard:openCompanyWizard, nextWizardStep:nextWizardStep, prevWizardStep:prevWizardStep, syncWizardClass:syncWizardClass, addWizardUser:addWizardUser, removeWizardUser:removeWizardUser, updateWizardUser:updateWizardUser, submitCompanyWizard:submitCompanyWizard, openDocUploader:openDocUploader, commitArcaUpload:commitArcaUpload, commitCertUpload:commitCertUpload, openDdjjModal:openDdjjModal, acceptDdjj:acceptDdjj };
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();