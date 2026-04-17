(function(){
'use strict';
function sb(){ return window.PS_BRIDGE && window.PS_BRIDGE.supabase ? window.PS_BRIDGE.supabase() : null; }
function cur(){ return window.CU || null; }
function esc(v){ return String(v==null?'':v).replace(/[&<>\"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]); }); }
function toastMsg(m,t){ if(typeof toast==='function') toast(m,t||'ok'); else console.log(m); }
function hasCompany(u){ return !!(u && u._sb_company_id); }
function verified(v){ v=String(v||'').toLowerCase(); return v==='verificado'||v==='verified'||v==='approved'; }
function pill(v){ var s=String(v||'pendiente').toLowerCase(); var cls=verified(s)?'ok':((s==='rejected'||s==='suspendido')?'bad':'warn'); return '<span class="ps77-pill '+cls+'">'+esc(s.replaceAll('_',' '))+'</span>'; }
function classification(range,intl){ if(intl===true) return 'Multinacional'; if(range==='1-10') return 'Pequeña'; if(range==='11-50') return 'Mediana'; if(range==='51-250') return 'Grande'; if(range==='+250') return 'Grande'; return ''; }
function dateStr(v){ if(!v) return '—'; try{ return new Date(v).toLocaleDateString('es-AR'); }catch(e){ return String(v); } }
function injectStyles(){
  if(document.getElementById('ps77-style')) return;
  var st=document.createElement('style');
  st.id='ps77-style';
  st.textContent=`
    .ps77-pill{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
    .ps77-pill.ok{background:rgba(44,168,94,.12);color:var(--grn)}
    .ps77-pill.warn{background:rgba(199,125,10,.12);color:var(--ac)}
    .ps77-pill.bad{background:rgba(221,68,68,.12);color:var(--red)}
    .ps77-filterbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .ps77-filterbtn{padding:7px 12px;border-radius:999px;border:1px solid var(--brd);background:var(--bg1);color:var(--t2);font-size:.76rem;font-weight:700;cursor:pointer}
    .ps77-filterbtn.on{background:var(--acg);border-color:var(--ac);color:var(--ac)}
    .ps77-req-section{background:var(--bg2);border:1px solid var(--brd2);border-radius:12px;padding:16px;margin-bottom:12px}
    .ps77-req-title{font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;display:flex;align-items:center;gap:8px}
    .ps77-req-card{border:1px solid var(--brd);border-radius:12px;background:var(--bg1);padding:12px;margin-bottom:10px}
    .ps77-req-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .ps77-req-meta{font-size:.8rem;color:var(--t3);line-height:1.6;margin-top:8px}
    .ps77-req-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .ps77-note{width:100%;margin-top:8px}
    .ps77-att{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  `;
  document.head.appendChild(st);
}
function closeOnb(){ var ov=document.getElementById('psOnbOverlay'); if(ov) ov.classList.remove('v'); }
function sanitizeRegister(){
  var fi=document.getElementById('fI'); if(!fi) return;
  Array.from(fi.querySelectorAll('.fg')).forEach(function(fg){
    var txt=((fg.querySelector('.fl')||{}).textContent||'').toLowerCase();
    if(txt.indexOf('empresa donde trabajás')!==-1 || txt.indexOf('cargo / rol')!==-1){ fg.style.display='none'; }
  });
  var first=fi.querySelector('.fst'); if(first) first.textContent='Datos personales';
}
async function fetchPendingCreateRequest(){
  var client=sb(), u=cur(); if(!client || !u || !u._sb_uid) return null;
  try{ var res=await client.from('company_requests').select('*').eq('requester_user_id',u._sb_uid).eq('request_type','create_new').order('created_at',{ascending:false}); if(res.error || !res.data || !res.data.length) return null; return (res.data||[]).find(function(r){ return ['pending','under_review','need_more_info'].indexOf(String(r.status||''))!==-1; }) || null; }catch(e){ return null; }
}
async function fetchCompanyContext(){
  var client=sb(), u=cur(); if(!client || !u || !u._sb_uid) return null;
  try{
    if(u._sb_company_id){ var cRes=await client.from('companies').select('*').eq('id',u._sb_company_id).single(); if(!cRes.error && cRes.data){ u._sb_company=cRes.data; u._sb_company_verification_status=cRes.data.verification_status||null; return {company:cRes.data}; } }
    var mRes=await client.from('company_members').select('company_id, role, cargo, area, companies(*)').eq('user_id',u._sb_uid).limit(1); if(mRes.error || !mRes.data || !mRes.data.length) return null; var m=mRes.data[0]; u._sb_company_id=m.company_id; u._sb_company=m.companies||null; u._sb_member_role=m.role||null; u._sb_company_verification_status=(m.companies&&m.companies.verification_status)||null; return {company:m.companies||null};
  }catch(e){ return null; }
}
function ensureCompanyButton(){
  var inWrap=document.getElementById('nIn'); if(!inWrap) return null;
  var btn=document.getElementById('nCompanyBtn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='nCompanyBtn';
    btn.className='bt bt-g bt-sm';
    btn.style.fontSize='.7rem';
    btn.style.color='var(--t2)';
    btn.style.visibility='hidden';
    btn.style.opacity='0';
    btn.style.pointerEvents='none';
    btn.textContent='Mi Empresa';
    btn.onclick=function(){ if(typeof go==='function') go('mycompany'); };
    var pbtn=inWrap.querySelector('button[onclick*="myprofile"]');
    if(pbtn && pbtn.parentNode) pbtn.parentNode.insertBefore(btn,pbtn.nextSibling); else inWrap.insertBefore(btn,inWrap.lastElementChild);
  }
  return btn;
}
var __ps77LastBtnState = null;
async function syncNav(){
  var btn=ensureCompanyButton(); if(!btn) return;
  var u=cur(); var show=false;
  if(u){ if(hasCompany(u)) show=true; else { var pending=await fetchPendingCreateRequest(); show=!!pending; } }
  if(__ps77LastBtnState===show) return;
  __ps77LastBtnState=show; btn.style.visibility=show?'visible':'hidden'; btn.style.opacity=show?'1':'0'; btn.style.pointerEvents=show?'auto':'none';
}
async function openStoredAny(path){
  var client=sb(); if(!client || !path) return toastMsg('Archivo no disponible','warn');
  try{ var bucket='attachments', filePath=path; if(String(path).indexOf('attachments:')===0){ bucket='attachments'; filePath=String(path).replace(/^attachments:/,''); } else if(String(path).indexOf('company-requests/')===0 || String(path).indexOf('company-docs/')===0){ bucket='attachments'; filePath=String(path); } else { bucket='certificates'; filePath=String(path); } var signed=await client.storage.from(bucket).createSignedUrl(filePath, 120); if(signed.error) throw signed.error; if(signed.data && signed.data.signedUrl) window.open(signed.data.signedUrl,'_blank','noopener'); else throw new Error('No se pudo generar el enlace temporal.'); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo abrir el archivo','err'); }
}
async function renderCleanOnboarding(forceOpen){
  var u=cur(); var ov=document.getElementById('psOnbOverlay');
  if(!u){ if(ov) ov.classList.remove('v'); return; }
  if(hasCompany(u) || u.role==='master'){ if(ov) ov.classList.remove('v'); return; }
  if(!ov){ ov=document.createElement('div'); ov.id='psOnbOverlay'; ov.className='ps-onb-overlay'; ov.innerHTML='<div class="ps-onb-card"><div class="ps-onb-head"><div class="ps-onb-title">Completá tu acceso empresarial</div><div class="ps-onb-sub" id="psOnbSub"></div></div><div class="ps-onb-body" id="psOnbBody"></div><div class="ps-onb-foot"><button class="bt bt-g" id="psOnbDismiss">Cerrar</button></div></div>'; document.body.appendChild(ov); document.getElementById('psOnbDismiss').onclick=closeOnb; }
  var sub=document.getElementById('psOnbSub'), body=document.getElementById('psOnbBody'); if(!sub || !body) return; var pending=await fetchPendingCreateRequest();
  sub.innerHTML = pending ? 'Tu empresa está en revisión. Patagonia Source validará la documentación dentro de las próximas 48 horas.' : 'Tu cuenta es personal. Podés registrar una empresa nueva o seguir navegando como viewer hasta que una empresa te vincule desde Mi Empresa.';
  if(pending){ var payload=pending.request_payload||{}; body.innerHTML='<div class="ps77-req-card"><div class="ps77-req-top"><div><div style="font-weight:700">'+esc(payload.razon_social||'Empresa en registro')+'</div><div class="ps77-req-meta">Solicitud activa</div></div><div>'+pill('en_verificacion')+'</div></div><div class="ps77-req-meta">La solicitud ya fue enviada correctamente. Ahora podés seguir navegando y acceder a Mi Empresa mientras el master admin revisa la documentación.</div><div class="ps77-req-actions"><button class="bt bt-s" id="ps77MyCompanyBtn">Abrir Mi Empresa</button><button class="bt bt-g" id="ps77ViewerBtn">Explorar por ahora</button></div></div>'; var mBtn=document.getElementById('ps77MyCompanyBtn'); if(mBtn) mBtn.onclick=function(){ closeOnb(); if(typeof go==='function') go('mycompany'); }; var vBtn=document.getElementById('ps77ViewerBtn'); if(vBtn) vBtn.onclick=function(){ closeOnb(); if(typeof go==='function') go('home'); }; }
  else { body.innerHTML='<div class="ps77-req-card"><div style="font-weight:700">Registrar nueva empresa</div><div class="ps77-req-meta">Completá el registro guiado, adjuntá CUIT y DDJJ obligatorios y enviá la solicitud para validación.</div><div class="ps77-req-actions"><button class="bt bt-s" id="ps77CreateBtn">Registrar nueva empresa</button><button class="bt bt-g" id="ps77ViewerBtn2">Explorar por ahora</button></div></div>'; var cBtn=document.getElementById('ps77CreateBtn'); if(cBtn) cBtn.onclick=function(){ if(window.PS_HOTFIX62 && window.PS_HOTFIX62.openCompanyWizard) window.PS_HOTFIX62.openCompanyWizard(); else toastMsg('El wizard todavía no cargó. Reintentá.','warn'); }; var vBtn2=document.getElementById('ps77ViewerBtn2'); if(vBtn2) vBtn2.onclick=function(){ closeOnb(); if(typeof go==='function') go('home'); }; }
  if(forceOpen || ov.classList.contains('v')) ov.classList.add('v');
}
function patchOnboarding(){
  if(!window.PS_ONBOARDING) window.PS_ONBOARDING={};
  window.PS_ONBOARDING.goCatalogForExisting=function(){ toastMsg('La búsqueda/reclamo de empresa existente ya no está habilitada.','info'); closeOnb(); };
  window.PS_ONBOARDING.openClaimRequest=function(){ toastMsg('Este flujo ya no está disponible.','warn'); closeOnb(); };
  window.PS_ONBOARDING.submitClaimRequest=function(){ toastMsg('Este flujo ya no está disponible.','warn'); closeOnb(); };
  window.PS_ONBOARDING.dismissOnboarding=closeOnb;
  window.PS_ONBOARDING.renderOnboarding=function(forceOpen){ renderCleanOnboarding(!!forceOpen); };
}
function patchGo(){
  if(window.__ps77GoPatched) return; window.__ps77GoPatched=true;
  var _go=window.go; window.go=function(p){ var rv=_go ? _go.apply(this, arguments) : void 0; if(p==='register') setTimeout(sanitizeRegister, 50); return rv; };
}
function patchWizardSubmit(){
  var target = (window.PS_V71 && window.PS_V71.submitCompanyWizard) ? window.PS_V71 : (window.PS_HOTFIX62 || null);
  if(!target || !target.submitCompanyWizard || window.__ps77SubmitPatched) return;
  window.__ps77SubmitPatched=true; var _submit=target.submitCompanyWizard;
  var wrap=async function(){ await _submit.apply(this, arguments); setTimeout(async function(){ var pending=await fetchPendingCreateRequest(); if(pending){ await syncNav(); closeOnb(); if(typeof go==='function') go('home'); toastMsg('Solicitud enviada con éxito. Patagonia Source revisará la documentación dentro de las próximas 48 horas.'); } }, 500); };
  target.submitCompanyWizard=wrap; if(window.PS_HOTFIX62) window.PS_HOTFIX62.submitCompanyWizard=wrap; if(window.PS_V71) window.PS_V71.submitCompanyWizard=wrap;
}
function patchCompanyActions(){
  if(!window.PS_HOTFIX62 || window.__ps77CompanyPatched) return; window.__ps77CompanyPatched=true;
  async function uploadFileWithFallback(file, preferredPath){ var client=sb(); if(!client) throw new Error('No hay conexión'); try{ var up=await client.storage.from('certificates').upload(preferredPath, file, {upsert:true}); if(up.error) throw up.error; return {ref:preferredPath}; }catch(e){} var fallback='company-docs/'+preferredPath; var up2=await client.storage.from('attachments').upload(fallback, file, {upsert:true}); if(up2.error) throw up2.error; return {ref:'attachments:'+fallback}; }
  window.PS_HOTFIX62.commitArcaUpload = async function(){
    var client=sb(), u=cur(); if(!client || !u) return; var ctx=await fetchCompanyContext(); if(!ctx || !ctx.company) return; var f=((document.getElementById('pscUploadFile')||{}).files||[])[0]; if(!f){ toastMsg('Seleccioná un archivo.','warn'); return; }
    try{
      var ext=f.name.includes('.')?f.name.substring(f.name.lastIndexOf('.')):'.pdf'; var uploaded=await uploadFileWithFallback(f, ctx.company.id+'/cuit_constancia'+ext);
      var ok=false;
      var upd=await client.from('companies').update({ cuit_constancia_url:uploaded.ref, cuit_constancia_at:new Date().toISOString() }).eq('id', ctx.company.id); if(!upd.error) ok=true;
      var row={ company_id:ctx.company.id, cert_type:'arca', file_url:uploaded.ref, file_name:f.name, status:'pending', issuer:null, cert_number:null, scope:null, issued_at:null, expires_at:null, reviewer_id:null, reviewer_notes:null, reviewed_at:null, reminder_sent_at:null };
      var cert=await client.from('company_certifications').upsert(row,{ onConflict:'company_id,cert_type' }); if(!cert.error) ok=true;
      if(!ok) throw new Error('No se pudo guardar la constancia');
      toastMsg('Constancia ARCA / CUIT cargada correctamente.');
      if(window.PS_HOTFIX62.renderMyCompany) await window.PS_HOTFIX62.renderMyCompany();
      syncCompanyState();
    }catch(e){ console.error(e); toastMsg('No se pudo cargar la constancia: '+(e.message||'error'),'err'); }
  };
  window.PS_HOTFIX62.saveCompanyCore = async function(){
    var client=sb(), u=cur(); if(!client || !u) return; var ctx=await fetchCompanyContext(); if(!ctx || !ctx.company) return; var old=ctx.company||{};
    var payload={ razon_social:(document.getElementById('ps62RS')||{}).value||'', cuit:(document.getElementById('ps62CUIT')||{}).value||'', tipo_societario:(document.getElementById('ps62Tipo')||{}).value||'', rubro_principal:(document.getElementById('ps62Rubro')||{}).value||'', empleados_aprox:(document.getElementById('ps62EmpRange')||{}).value||null, clasificacion:(document.getElementById('ps62Class')||{}).value||null, email_empresa:(document.getElementById('ps62Mail')||{}).value||'', telefono_empresa:(document.getElementById('ps62Tel')||{}).value||'', sede_central:(document.getElementById('ps62Sede')||{}).value||'', bases_operativas:((document.getElementById('ps62Bases')||{}).value||'').split(',').map(function(v){return v.trim();}).filter(Boolean), sitio_web:(document.getElementById('ps62Web')||{}).value||'', descripcion:(document.getElementById('ps62Desc')||{}).value||'' };
    var keyChanged = payload.razon_social!==String(old.razon_social||'') || payload.cuit!==String(old.cuit||'') || payload.tipo_societario!==String(old.tipo_societario||'');
    try{
      var updPayload=Object.assign({}, payload);
      if(keyChanged){ updPayload.verification_status='pendiente'; updPayload.is_verified=false; }
      var upd=await client.from('companies').update(updPayload).eq('id', old.id); if(upd.error) throw upd.error;
      if(keyChanged){
        var reqPayload={ reason:'company_core_update', changes:payload };
        var inserted=false;
        try{ var rpc=await client.rpc('submit_company_update_request_secure', { p_company_id:old.id, p_request_payload:reqPayload }); if(!rpc.error) inserted=true; }catch(e){}
        if(!inserted){ var ins=await client.from('company_requests').insert({ requester_user_id:u._sb_uid, request_type:'company_update', target_company_id:old.id, assigned_role:'owner', status:'pending', request_payload:reqPayload, requester_message:'Modificación de datos clave de empresa' }); if(ins.error) console.warn(ins.error); }
        toastMsg('Datos clave actualizados. Se relanzó revisión del master admin y la empresa pierde el verificado temporalmente.','info');
      }else toastMsg('Empresa actualizada.');
      if(window.PS_HOTFIX62.renderMyCompany) await window.PS_HOTFIX62.renderMyCompany();
      await syncCompanyState();
    }catch(e){ console.error(e); toastMsg(e.message||'No se pudo guardar la empresa','err'); }
  };
  var _renderMyCompany=window.PS_HOTFIX62.renderMyCompany;
  window.PS_HOTFIX62.renderMyCompany = async function(){
    await _renderMyCompany.apply(this, arguments);
    try{
      var box=document.getElementById('myCompanyContent'); var u=cur(); if(!box || !u || !u._sb_company_id) return;
      var client=sb(); if(!client) return;
      var compRes=await client.from('companies').select('id,verification_status,is_verified,cuit_constancia_url,cuit_constancia_at,ddjj_accepted_at').eq('id', u._sb_company_id).single();
      var certRes=await client.from('company_certifications').select('*').eq('company_id', u._sb_company_id).eq('cert_type','arca').limit(1);
      var comp=compRes.error?{}:(compRes.data||{}); var arca=(certRes.error||!certRes.data||!certRes.data.length)?null:certRes.data[0];
      var loadedAt = comp.cuit_constancia_at || (arca && (arca.updated_at||arca.created_at||arca.issued_at)) || null;
      var url = comp.cuit_constancia_url || (arca && arca.file_url) || null;
      var card=Array.from(box.querySelectorAll('.ps62-card')).find(function(c){ var t=(c.querySelector('.ps62-title')||{}).textContent||''; return t.trim().toLowerCase()==='documentación y certificaciones'; });
      if(card){
        var kvs=card.querySelectorAll('.ps62-kv');
        if(kvs[0]){ var v=kvs[0].querySelector('.ps62-v'); if(v) v.innerHTML=pill(comp.verification_status || (comp.is_verified?'verificado':'pendiente')); }
        if(kvs[1]){ var v2=kvs[1].querySelector('.ps62-v'); if(v2) v2.textContent=loadedAt ? ('Cargado el '+dateStr(loadedAt)) : 'Pendiente (obligatorio)'; }
        var docs=card.querySelectorAll('.ps62-doc');
        if(docs[0]){ var help=docs[0].querySelector('.ps62-help'); if(help) help.textContent=loadedAt ? ('Cargada el '+dateStr(loadedAt)) : 'Pendiente (obligatoria)'; var actions=docs[0].querySelector('.ps62-inline:last-child'); if(actions && url){ if(!actions.innerHTML.includes('Abrir')) actions.insertAdjacentHTML('afterbegin','<button class="bt bt-s bt-sm" onclick="window.PS_V77.openAttachment(\''+String(url).replace(/'/g,"\\'")+'\')">Abrir</button>'); } }
      }
    }catch(e){ console.warn('renderMyCompany normalize', e); }
  };
}
async function syncCompanyState(){
  var client=sb(); if(!client || typeof ST==='undefined') return;
  try{ var ids=(ST.empresas||[]).map(function(e){ return e._sb_id; }).filter(Boolean); if(!ids.length) return; var res=await client.from('companies').select('id,verification_status,is_verified,clasificacion,empleados_aprox,operacion_internacional,updated_at').in('id', ids); if(res.error) throw res.error; (res.data||[]).forEach(function(c){ var emp=(ST.empresas||[]).find(function(e){ return e._sb_id===c.id; }); if(!emp) return; emp.v=!!(c.is_verified||verified(c.verification_status)); emp._verification_status=c.verification_status||(emp.v?'verificado':'pendiente'); emp.employeeRange=c.empleados_aprox||emp.employeeRange||''; emp.internationalOps=(typeof c.operacion_internacional==='boolean')?c.operacion_internacional:emp.internationalOps; emp.companyClass=c.clasificacion||classification(emp.employeeRange||'',!!emp.internationalOps)||emp.companyClass||''; emp.act=c.updated_at?new Date(c.updated_at).toLocaleDateString('es-AR'):emp.act; }); if(typeof renderFeat==='function') renderFeat(); if(document.getElementById('pg-catalog')&&document.getElementById('pg-catalog').classList.contains('on')&&typeof renderCat==='function') renderCat(); }catch(e){ console.warn('syncCompanyState', e); }
}
async function fetchRequestsForAdmin(){
  var client=sb(); if(!client) return {rows:[], profiles:{}, companies:{}}; var res=await client.from('company_requests').select('*').order('created_at',{ascending:false}); if(res.error) throw res.error; var rows=res.data||[]; var userIds=[...new Set(rows.map(function(r){ return r.requester_user_id; }).filter(Boolean))]; var companyIds=[...new Set(rows.map(function(r){ return r.target_company_id||r.approved_company_id; }).filter(Boolean))]; var profiles=userIds.length?await client.from('profiles').select('id,email,nombre,apellido').in('id', userIds):{data:[]}; var companies=companyIds.length?await client.from('companies').select('id,razon_social,nombre_fantasia,cuit,verification_status,is_verified').in('id', companyIds):{data:[]}; var profMap={}, compMap={}; (profiles.data||[]).forEach(function(p){ profMap[p.id]=p; }); (companies.data||[]).forEach(function(c){ compMap[c.id]=c; }); return {rows:rows, profiles:profMap, companies:compMap}; }
function reqCardHtml(r, profiles, companies){
  var p=profiles[r.requester_user_id]||{}; var c=companies[r.target_company_id]||companies[r.approved_company_id]||{}; var payload=r.request_payload||{}; var cls=String(r.status||'pending').toLowerCase(); var label=r.request_type==='company_update'?((c.nombre_fantasia||c.razon_social||payload.razon_social||'Empresa')+' · Actualización'):(payload.razon_social||c.nombre_fantasia||c.razon_social||'Nueva empresa'); var attachments=(r.attachments||[]); var meta='<div class="ps77-req-meta"><strong>Solicitante:</strong> '+esc((((p.nombre||'')+' '+(p.apellido||'')).trim())||p.email||'Usuario')+' · '+esc(p.email||'')+'</div><div class="ps77-req-meta"><strong>CUIT:</strong> '+esc(payload.cuit||c.cuit||'—')+' · <strong>Tipo:</strong> '+esc(payload.tipo_societario||'—')+' · <strong>Rubro:</strong> '+esc(payload.rubro_principal||'—')+'</div><div class="ps77-req-meta"><strong>Sede:</strong> '+esc(payload.sede_central||'—')+' · <strong>Mail empresa:</strong> '+esc(payload.email_empresa||'—')+' · <strong>Clasificación:</strong> '+esc(payload.clasificacion||classification(payload.empleados_aprox||'',!!payload.operacion_internacional)||'—')+'</div>'+(payload.telefono_empresa?'<div class="ps77-req-meta"><strong>Tel. empresa:</strong> '+esc(payload.telefono_empresa)+'</div>':'')+(payload.bases_operativas&&payload.bases_operativas.length?'<div class="ps77-req-meta"><strong>Bases operativas:</strong> '+esc(payload.bases_operativas.join(', '))+'</div>':'')+(payload.descripcion?'<div class="ps77-req-meta"><strong>Descripción:</strong> '+esc(payload.descripcion)+'</div>':''); var atts=''; if(attachments.length){ atts='<div class="ps77-att">'+attachments.map(function(a){ var path=a.path||a.file_url||''; var lbl=(a.kind||a.name||'adjunto').replaceAll('_',' '); return '<button class="bt bt-g bt-sm" onclick="window.PS_V77.openAttachment(\''+String(path).replace(/'/g,"\\'")+'\')">'+esc(lbl)+'</button>'; }).join('')+'</div>'; } var actions=''; if(['pending','under_review','need_more_info'].indexOf(cls)!==-1){ actions='<textarea class="ps77-note" id="ps77Note-'+r.id+'" rows="3" placeholder="Observaciones internas / mensaje al solicitante">'+esc(r.reviewer_notes||'')+'</textarea><div class="ps77-req-actions"><button class="bt bt-g bt-sm" onclick="window.PS_V77.reqUnderReview(\''+r.id+'\')">Pedir más info</button><button class="bt bt-d bt-sm" onclick="window.PS_V77.reqReject(\''+r.id+'\')">Rechazar</button><button class="bt bt-p bt-sm" onclick="window.PS_V77.reqApprove(\''+r.id+'\')">Aprobar</button></div>'; } else if(r.reviewer_notes){ actions='<div class="ps77-req-meta"><strong>Notas revisor:</strong> '+esc(r.reviewer_notes)+'</div>'; } return '<div class="ps77-req-card" data-status="'+esc(cls)+'"><div class="ps77-req-top"><div><div style="font-weight:700">'+esc(label)+'</div><div class="ps77-sub">'+esc((r.request_type||'').replaceAll('_',' '))+' · '+pill(cls)+'</div></div><div class="ps77-sub">'+new Date(r.created_at).toLocaleString('es-AR')+'</div></div>'+meta+atts+actions+'</div>'; }
function setReqFilter(key){ var dm=document.getElementById('dmMain'); if(!dm) return; Array.from(dm.querySelectorAll('.ps77-filterbtn')).forEach(function(b){ b.classList.toggle('on', b.dataset.filter===key); }); Array.from(dm.querySelectorAll('.ps77-req-section')).forEach(function(sec){ var st=sec.dataset.section; sec.style.display=(key==='all'||st===key)?'':'none'; }); }
async function renderAdminRequests(container){ try{ var pack=await fetchRequestsForAdmin(); var rows=pack.rows, profiles=pack.profiles, companies=pack.companies; var pend=rows.filter(function(r){ return ['pending','under_review','need_more_info'].indexOf(String(r.status||''))!==-1; }); var appr=rows.filter(function(r){ return String(r.status||'')==='approved'; }); var rej=rows.filter(function(r){ return String(r.status||'')==='rejected'; }); function section(title,key,arr){ return '<div class="ps77-req-section" data-section="'+key+'"><div class="ps77-req-title">'+title+' <span class="bdg '+(arr.length?'bdg-r':'bdg-v')+'">'+arr.length+'</span></div>'+(arr.length?arr.map(function(r){ return reqCardHtml(r, profiles, companies); }).join(''):'<div class="ps77-sub">Sin registros.</div>')+'</div>'; } var filters='<div class="ps77-filterbar"><button class="ps77-filterbtn on" data-filter="all" onclick="window.PS_V77.setFilter(\'all\')">Todos</button><button class="ps77-filterbtn" data-filter="pending" onclick="window.PS_V77.setFilter(\'pending\')">Pendientes</button><button class="ps77-filterbtn" data-filter="approved" onclick="window.PS_V77.setFilter(\'approved\')">Aprobados</button><button class="ps77-filterbtn" data-filter="rejected" onclick="window.PS_V77.setFilter(\'rejected\')">Rechazados</button></div>'; container.innerHTML=filters+section('Pendientes','pending',pend)+section('Aprobados','approved',appr)+section('Rechazados','rejected',rej); }catch(e){ console.error(e); container.innerHTML='<div class="adm-sec"><div class="adm-t">Solicitudes</div><div class="ps77-sub">No se pudieron cargar las solicitudes.</div></div>'; } }
async function approveRequest(id){ var client=sb(); if(!client) return; try{ var note=(document.getElementById('ps77Note-'+id)||{}).value||null; var rpc=await client.rpc('approve_company_request', { p_request_id:id, p_assigned_role:'owner', p_reviewer_notes:note||null }); if(rpc.error) throw rpc.error; var req=await client.from('company_requests').select('*').eq('id',id).single(); if(req.error) throw req.error; var row=req.data||{}; if(String(row.status||'')!=='approved'){ var updReq=await client.from('company_requests').update({ status:'approved', reviewer_notes:note||null }).eq('id',id); if(updReq.error) throw updReq.error; row.status='approved'; } var companyId=row.approved_company_id || row.target_company_id || null; if(companyId){ var updComp=await client.from('companies').update({ verification_status:'verificado', is_verified:true }).eq('id', companyId); if(updComp.error) console.warn(updComp.error); } toastMsg('Solicitud aprobada y empresa verificada.'); await syncCompanyState(); if(typeof window.renderDash==='function') window.renderDash('requests'); if(window.PS_HOTFIX62 && window.PS_HOTFIX62.renderMyCompany) window.PS_HOTFIX62.renderMyCompany(); syncNav(); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo aprobar','err'); } }
async function rejectRequest(id){ var client=sb(); if(!client) return; var reason=prompt('Motivo del rechazo:'); if(reason===null) return; try{ var note=(document.getElementById('ps77Note-'+id)||{}).value||null; var rpc=await client.rpc('reject_company_request', { p_request_id:id, p_reason:reason, p_reviewer_notes:note||null }); if(rpc.error) throw rpc.error; var upd=await client.from('company_requests').update({ status:'rejected', reviewer_notes:note||null }).eq('id',id); if(upd.error) console.warn(upd.error); toastMsg('Solicitud rechazada.','info'); if(typeof window.renderDash==='function') window.renderDash('requests'); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo rechazar','err'); } }
async function setUnderReview(id){ var client=sb(); if(!client) return; var note=prompt('¿Qué información adicional necesitás pedir?'); if(note===null) return; try{ var rpc=await client.rpc('request_company_request_more_info', { p_request_id:id, p_reviewer_notes:note||'' }); if(rpc.error) throw rpc.error; var upd=await client.from('company_requests').update({ status:'need_more_info', reviewer_notes:note||'' }).eq('id',id); if(upd.error) console.warn(upd.error); toastMsg('Se solicitó más información.','info'); if(typeof window.renderDash==='function') window.renderDash('requests'); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo actualizar','err'); } }
function patchRenderDash(){ if(window.__ps77DashPatched) return; window.__ps77DashPatched=true; var _render=window.renderDash; window.renderDash=async function(tab){ var u=cur(); if(u && u.role==='master' && tab==='requests'){ if(_render) _render('admin'); var tabs=document.querySelector('#pg-dashboard .ds-tabs'); if(tabs){ Array.from(tabs.children).forEach(function(el){ el.classList.remove('on'); if((el.textContent||'').trim().toLowerCase()==='solicitudes') el.classList.add('on'); }); } var dm=document.getElementById('dmMain'); if(dm) await renderAdminRequests(dm); return; } return _render ? _render.apply(this, arguments) : void 0; }; }
window.PS_V77={ reqApprove:approveRequest, reqReject:rejectRequest, reqUnderReview:setUnderReview, openAttachment:openStoredAny, setFilter:setReqFilter };
function boot(){ injectStyles(); sanitizeRegister(); patchOnboarding(); patchGo(); patchWizardSubmit(); patchCompanyActions(); patchRenderDash(); syncNav(); renderCleanOnboarding(false); syncCompanyState(); setInterval(function(){ sanitizeRegister(); syncNav(); renderCleanOnboarding(false); syncCompanyState(); }, 2000); console.log('[PS v7.7] patch activo'); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();