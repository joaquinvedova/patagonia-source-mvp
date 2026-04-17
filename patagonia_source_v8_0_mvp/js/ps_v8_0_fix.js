(function(){
'use strict';
function sb(){ return window.PS_BRIDGE && window.PS_BRIDGE.supabase ? window.PS_BRIDGE.supabase() : null; }
function cur(){ return window.CU || null; }
function esc(v){ return String(v==null?'':v).replace(/[&<>\"']/g,function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]); }); }
function toastMsg(m,t){ if(typeof toast==='function') toast(m,t||'ok'); else console.log(m); }
function verified(v){ v=String(v||'').toLowerCase(); return v==='verificado'||v==='verified'||v==='approved'; }
function dateStr(v){ if(!v) return '—'; try{ return new Date(v).toLocaleDateString('es-AR'); }catch(e){ return String(v); } }
function closeSheet(){ var el=document.getElementById('psSheet'); if(el) el.classList.remove('v'); }
function closeOnb(){ var el=document.getElementById('psOnbOverlay'); if(el) el.classList.remove('v'); }
function closeAll(){ closeSheet(); closeOnb(); }
function classification(range,intl){ if(intl===true) return 'Multinacional'; if(range==='1-10') return 'Pequeña'; if(range==='11-50') return 'Mediana'; if(range==='51-250') return 'Grande'; if(range==='+250') return 'Grande'; return ''; }
function isMaster(u){ return !!(u && u.role==='master'); }
function hasCompany(u){ return !!(u && u._sb_company_id); }
function isOwner(u){ return !!(u && (u._sb_member_role==='owner' || u.role==='master')); }
function statusPill(s){
  var v=String(s||'pending').toLowerCase();
  var cls = verified(v)?'ok':((v==='rejected'||v==='suspendido')?'bad':'warn');
  return '<span class="ps80-pill '+cls+'">'+esc(v.replaceAll('_',' '))+'</span>';
}
function injectStyles(){
  if(document.getElementById('ps80-style')) return;
  var st=document.createElement('style');
  st.id='ps80-style';
  st.textContent=`
    .ps80-pill{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
    .ps80-pill.ok{background:rgba(44,168,94,.12);color:var(--grn)}
    .ps80-pill.warn{background:rgba(199,125,10,.12);color:var(--ac)}
    .ps80-pill.bad{background:rgba(221,68,68,.12);color:var(--red)}
    .ps80-filterbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    .ps80-filterbtn{padding:7px 12px;border-radius:999px;border:1px solid var(--brd);background:var(--bg1);color:var(--t2);font-size:.76rem;font-weight:700;cursor:pointer}
    .ps80-filterbtn.on{background:var(--acg);border-color:var(--ac);color:var(--ac)}
    .ps80-req-section{background:var(--bg2);border:1px solid var(--brd2);border-radius:12px;padding:16px;margin-bottom:12px}
    .ps80-req-title{font-family:'Barlow Condensed',sans-serif;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;display:flex;align-items:center;gap:8px}
    .ps80-req-card{border:1px solid var(--brd);border-radius:12px;background:var(--bg1);padding:14px;margin-bottom:10px}
    .ps80-req-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
    .ps80-req-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px}
    .ps80-req-meta{font-size:.8rem;color:var(--t3);line-height:1.6}
    .ps80-req-subtitle{font-size:.76rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-top:10px;margin-bottom:6px}
    .ps80-req-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .ps80-note{width:100%;margin-top:8px}
    .ps80-att{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .ps80-notif-card{border:1px solid var(--brd);border-radius:12px;background:var(--bg2);padding:14px;margin-bottom:10px}
    .ps80-notif-title{font-weight:700;font-size:.9rem}
    .ps80-notif-body{font-size:.82rem;color:var(--t2);line-height:1.6;margin-top:4px}
    .ps80-notif-meta{font-size:.74rem;color:var(--t3);margin-top:8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
    @media(max-width:900px){.ps80-req-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(st);
}
function friendlySqlMsg(e){
  var m=(e&&e.message)||'';
  var low=String(m).toLowerCase();
  if(low.indexOf('submit_company_update_request_secure')!==-1 || low.indexOf('row-level security')!==-1 || low.indexOf('permission denied')!==-1){
    return 'Falta ejecutar el SQL final del MVP (`migrations_v8_0_mvp.sql`) para habilitar las actualizaciones seguras y las notificaciones.';
  }
  return m || 'Ocurrió un error.';
}
function stripStoragePrefix(path){
  var v=String(path||'');
  if(v.indexOf('attachments:')===0) return {bucket:'attachments', path:v.replace(/^attachments:/,'')};
  if(v.indexOf('certificates:')===0) return {bucket:'certificates', path:v.replace(/^certificates:/,'')};
  if(v.indexOf('company-requests/')===0 || v.indexOf('company-docs/')===0) return {bucket:'attachments', path:v};
  return {bucket:'certificates', path:v};
}
async function openStoredAny(path){
  var client=sb(); if(!client || !path) return toastMsg('Archivo no disponible','warn');
  try{
    var info=stripStoragePrefix(path);
    var signed=await client.storage.from(info.bucket).createSignedUrl(info.path, 120);
    if(signed.error) throw signed.error;
    if(signed.data && signed.data.signedUrl) window.open(signed.data.signedUrl,'_blank','noopener');
    else throw new Error('No se pudo generar el enlace temporal.');
  }catch(e){ console.error(e); toastMsg(e.message||'No se pudo abrir el archivo','err'); }
}
async function fetchCompanyContext(){
  var client=sb(), u=cur();
  if(!client || !u || !u._sb_uid) return null;
  try{
    if(u._sb_company_id){
      var cRes=await client.from('companies').select('*').eq('id',u._sb_company_id).single();
      if(!cRes.error && cRes.data){
        u._sb_company = cRes.data;
        u._sb_company_verification_status = cRes.data.verification_status || null;
        return { company:cRes.data };
      }
    }
    var mRes=await client.from('company_members').select('company_id, role, cargo, area, companies(*)').eq('user_id',u._sb_uid).limit(1);
    if(mRes.error || !mRes.data || !mRes.data.length) return null;
    var m=mRes.data[0];
    u._sb_company_id=m.company_id; u._sb_company=m.companies||null; u._sb_member_role=m.role||null; u._sb_member_cargo=m.cargo||null; u._sb_member_area=m.area||null; u._sb_company_verification_status=(m.companies&&m.companies.verification_status)||null;
    return { company:m.companies||null };
  }catch(e){ console.error('[PS80] fetchCompanyContext', e); return null; }
}
function readCompanyFormSnapshot(base){
  base = base || {};
  function gv(id, fallback){ var el=document.getElementById(id); return el ? (el.value||'').trim() : (fallback==null?'':fallback); }
  var bases = gv('ps62Bases', Array.isArray(base.bases_operativas)?base.bases_operativas.join(', '):(base.bases_operativas||''));
  return {
    razon_social: gv('ps62RS', base.razon_social||''),
    cuit: gv('ps62CUIT', base.cuit||''),
    tipo_societario: gv('ps62Tipo', base.tipo_societario||''),
    rubro_principal: gv('ps62Rubro', base.rubro_principal||''),
    empleados_aprox: gv('ps62EmpRange', base.empleados_aprox||''),
    clasificacion: gv('ps62Class', base.clasificacion||classification(base.empleados_aprox||'', !!base.operacion_internacional)||''),
    email_empresa: gv('ps62Mail', base.email_empresa||''),
    telefono_empresa: gv('ps62Tel', base.telefono_empresa||''),
    sede_central: gv('ps62Sede', base.sede_central||''),
    bases_operativas: bases ? bases.split(',').map(function(v){return v.trim();}).filter(Boolean) : (Array.isArray(base.bases_operativas)?base.bases_operativas:[]),
    sitio_web: gv('ps62Web', base.sitio_web||''),
    descripcion: gv('ps62Desc', base.descripcion||'')
  };
}
function mergeAttachments(a,b){
  var out=[], seen={};
  (Array.isArray(a)?a:[]).concat(Array.isArray(b)?b:[]).forEach(function(it){
    if(!it) return;
    var key=String(it.path||it.file_url||it.name||JSON.stringify(it));
    if(seen[key]) return; seen[key]=1; out.push(it);
  });
  return out;
}
async function uploadArcaFile(file, companyId){
  var client=sb(); if(!client || !file || !companyId) throw new Error('No hay datos suficientes');
  var ext=file.name && file.name.indexOf('.')!==-1 ? file.name.substring(file.name.lastIndexOf('.')) : '.pdf';
  var clean='cuit_constancia'+ext;
  var preferred=companyId + '/' + clean;
  try{
    var up=await client.storage.from('certificates').upload(preferred, file, {upsert:true});
    if(!up.error) return {ref:'certificates:'+preferred, bucket:'certificates'};
  }catch(e){}
  var fallback='company-docs/'+companyId+'/'+Date.now()+'-'+clean;
  var up2=await client.storage.from('attachments').upload(fallback, file, {upsert:true});
  if(up2.error) throw up2.error;
  return {ref:'attachments:'+fallback, bucket:'attachments'};
}
async function submitSecureCompanyUpdateRequest(companyId, payload, message, attachments){
  var client=sb(), u=cur();
  if(!client || !u || !u._sb_uid || !companyId) throw new Error('No hay datos suficientes para generar la revisión.');
  var requesterPhone=(u._sb_profile&&u._sb_profile.telefono)||u.telPersonal||'';
  var rpc=await client.rpc('submit_company_update_request_secure', {
    p_company_id: companyId,
    p_request_payload: payload || {},
    p_requester_message: message || 'Actualización de empresa',
    p_requester_phone: requesterPhone || null,
    p_attachments: attachments || []
  });
  if(rpc.error) throw rpc.error;
  return rpc.data;
}
async function notifyUser(userId, type, title, body, category, meta){
  var client=sb(); if(!client || !userId) return;
  try{
    var rpc=await client.rpc('create_notification', { p_user_id:userId, p_type:type, p_title:title, p_body:body, p_category:category||'company_requests', p_meta:meta||{} });
    if(rpc.error) throw rpc.error;
  }catch(e){ console.warn('[PS80] notification', e); }
}
async function syncCompanyState(){
  var client=sb(); if(!client || typeof ST==='undefined') return;
  try{
    var ids=(ST.empresas||[]).map(function(e){ return e._sb_id; }).filter(Boolean);
    if(!ids.length) return;
    var res=await client.from('companies').select('id,verification_status,is_verified,clasificacion,empleados_aprox,operacion_internacional,updated_at,cuit_constancia_url,cuit_constancia_at').in('id', ids);
    if(res.error) throw res.error;
    (res.data||[]).forEach(function(c){
      var emp=(ST.empresas||[]).find(function(e){ return e._sb_id===c.id; });
      if(!emp) return;
      emp.v = !!(c.is_verified || verified(c.verification_status));
      emp._verification_status = c.verification_status || (emp.v?'verificado':'pendiente');
      emp.employeeRange = c.empleados_aprox || emp.employeeRange || '';
      emp.internationalOps = typeof c.operacion_internacional==='boolean' ? c.operacion_internacional : emp.internationalOps;
      emp.companyClass = c.clasificacion || classification(emp.employeeRange||'', !!emp.internationalOps) || emp.companyClass || '';
      emp._cuit_constancia_url = c.cuit_constancia_url || emp._cuit_constancia_url || null;
      emp._cuit_loaded = !!(c.cuit_constancia_url || emp._cuit_constancia_url);
      emp.act = c.updated_at ? new Date(c.updated_at).toLocaleDateString('es-AR') : emp.act;
    });
    if(typeof renderFeat==='function') renderFeat();
    if(document.getElementById('pg-catalog') && document.getElementById('pg-catalog').classList.contains('on') && typeof renderCat==='function') renderCat();
  }catch(e){ console.warn('[PS80] syncCompanyState', e); }
}
async function fetchPendingCreateRequest(){
  var client=sb(), u=cur(); if(!client || !u || !u._sb_uid) return null;
  try{
    var res=await client.from('company_requests').select('*').eq('requester_user_id', u._sb_uid).eq('request_type','create_new').order('created_at',{ascending:false});
    if(res.error || !res.data || !res.data.length) return null;
    return (res.data||[]).find(function(r){ return ['pending','under_review','need_more_info'].indexOf(String(r.status||''))!==-1; }) || null;
  }catch(e){ return null; }
}
async function patchCommitArcaUpload(){
  if(!window.PS_HOTFIX62 || window.__ps80ArcaPatched) return;
  window.__ps80ArcaPatched=true;
  window.PS_HOTFIX62.commitArcaUpload = async function(){
    var client=sb(), u=cur();
    if(!client || !u) return;
    var ctx=await fetchCompanyContext();
    if(!ctx || !ctx.company) return;
    var f=((document.getElementById('pscUploadFile')||{}).files||[])[0];
    if(!f){ toastMsg('Seleccioná un archivo.','warn'); return; }
    try{
      var uploaded=await uploadArcaFile(f, ctx.company.id);
      var snapshot=readCompanyFormSnapshot(ctx.company);
      var attachments=[{ kind:'arca', path:uploaded.ref, name:f.name||'Constancia ARCA/CUIT', size:f.size||0, uploaded_at:new Date().toISOString() }];
      await submitSecureCompanyUpdateRequest(ctx.company.id, { reason:'arca_update', arca_updated:true, company_snapshot:snapshot }, 'Actualización de constancia ARCA / CUIT', attachments);
      var updates={ cuit_constancia_url:uploaded.ref, cuit_constancia_at:new Date().toISOString(), verification_status:'pendiente', is_verified:false };
      var upd=await client.from('companies').update(updates).eq('id', ctx.company.id);
      if(upd.error) throw upd.error;
      closeAll();
      toastMsg('Constancia ARCA / CUIT cargada correctamente. La empresa vuelve a pendiente hasta nueva validación.','ok');
      if(window.PS_HOTFIX62.renderMyCompany) await window.PS_HOTFIX62.renderMyCompany();
      await syncCompanyState();
    }catch(e){ console.error(e); toastMsg(friendlySqlMsg(e),'err'); }
  };
}
async function patchSaveCompanyCore(){
  if(!window.PS_HOTFIX62 || window.__ps80SaveCorePatched) return;
  window.__ps80SaveCorePatched=true;
  window.PS_HOTFIX62.saveCompanyCore = async function(){
    var client=sb(), u=cur();
    if(!client || !u || !isOwner(u)) return;
    var ctx=await fetchCompanyContext();
    if(!ctx || !ctx.company) return;
    var old=ctx.company;
    var snapshot=readCompanyFormSnapshot(old);
    var keyChanged = snapshot.razon_social!==String(old.razon_social||'') || snapshot.cuit!==String(old.cuit||'') || snapshot.tipo_societario!==String(old.tipo_societario||'');
    try{
      if(keyChanged){
        await submitSecureCompanyUpdateRequest(old.id, { reason:'company_core_update', previous_core:{ razon_social:old.razon_social||'', cuit:old.cuit||'', tipo_societario:old.tipo_societario||'' }, company_snapshot:snapshot }, 'Actualización de datos clave de empresa', []);
      }
      var updates=Object.assign({}, snapshot);
      if(keyChanged){ updates.verification_status='pendiente'; updates.is_verified=false; }
      var upd=await client.from('companies').update(updates).eq('id', old.id);
      if(upd.error) throw upd.error;
      if(keyChanged) toastMsg('Datos clave actualizados. La empresa vuelve a pendiente hasta nueva validación del master admin.','info');
      else toastMsg('Empresa actualizada.');
      if(window.PS_HOTFIX62.renderMyCompany) await window.PS_HOTFIX62.renderMyCompany();
      await syncCompanyState();
    }catch(e){ console.error(e); toastMsg(friendlySqlMsg(e),'err'); }
  };
}
function normalizeMyCompanyUI(){
  var box=document.getElementById('myCompanyContent');
  if(!box) return;
  var cards=Array.from(box.querySelectorAll('.ps62-card'));
  var docCard=cards.find(function(c){ var t=(c.querySelector('.ps62-title')||{}).textContent||''; return t.trim().toLowerCase()==='documentación y certificaciones'; });
  if(!docCard) return;
  var banner=docCard.querySelector('.ps62-banner');
  if(banner) banner.innerHTML='<strong>Regla de admisión:</strong> crear una empresa no la deja verificada. Patagonia Source valida constancia ARCA / CUIT y documentación complementaria. Cada certificado aprobado libera su sello correspondiente.';
  Array.from(docCard.querySelectorAll('.ps62-kv')).forEach(function(row){
    var k=((row.querySelector('.ps62-k')||{}).textContent||'').trim().toLowerCase();
    if(k==='ddjj' || k.indexOf('declaración')!==-1) row.remove();
  });
  Array.from(docCard.querySelectorAll('.ps62-doc')).forEach(function(block){
    var title=(block.textContent||'').trim().toLowerCase();
    if(title.indexOf('declaración jurada')!==-1) block.remove();
  });
}
async function patchRenderMyCompany(){
  if(!window.PS_HOTFIX62 || !window.PS_HOTFIX62.renderMyCompany || window.__ps80RenderPatched) return;
  window.__ps80RenderPatched=true;
  var _render=window.PS_HOTFIX62.renderMyCompany;
  window.PS_HOTFIX62.renderMyCompany = async function(){
    await _render.apply(this, arguments);
    normalizeMyCompanyUI();
  };
}
async function patchCreateSubmitAndSuppressOnboarding(){
  if(window.__ps80CreatePatched) return;
  window.__ps80CreatePatched=true;
  if(window.PS_ONBOARDING && window.PS_ONBOARDING.renderOnboarding && !window.__ps80OnbSuppression){
    window.__ps80OnbSuppression=true;
    var _renderOnb=window.PS_ONBOARDING.renderOnboarding;
    window.PS_ONBOARDING.renderOnboarding = async function(forceOpen){
      if(window.__ps80SuppressOnb){ closeAll(); return; }
      return _renderOnb ? _renderOnb.apply(this, arguments) : void 0;
    };
  }
  var target = (window.PS_V71 && window.PS_V71.submitCompanyWizard) ? window.PS_V71 : (window.PS_HOTFIX62 || null);
  if(!target || !target.submitCompanyWizard) return;
  var _submit=target.submitCompanyWizard;
  var wrap=async function(){
    await _submit.apply(this, arguments);
    setTimeout(async function(){
      try{
        var pending=await fetchPendingCreateRequest();
        if(!pending) return;
        var payload=Object.assign({}, pending.request_payload||{});
        if(!payload.ddjj){
          payload.ddjj={ accepted:true, accepted_at:new Date().toISOString(), source:'create_company_wizard' };
          try{ await sb().from('company_requests').update({ request_payload:payload }).eq('id', pending.id); }catch(e){}
        }
        window.__ps80SuppressOnb=true;
        closeAll();
        if(typeof go==='function') go('home');
        toastMsg('Solicitud enviada con éxito. Patagonia Source revisará la documentación dentro de las próximas 48 horas.','ok');
        setTimeout(function(){ window.__ps80SuppressOnb=false; }, 1800);
      }catch(e){ console.warn('[PS80] create submit finalizer', e); }
    }, 350);
  };
  target.submitCompanyWizard=wrap;
  if(window.PS_HOTFIX62) window.PS_HOTFIX62.submitCompanyWizard=wrap;
  if(window.PS_V71) window.PS_V71.submitCompanyWizard=wrap;
}
function requestPayloadView(r, c){
  var payload=r.request_payload||{};
  var snapshot=payload.company_snapshot || payload.changes || payload;
  var rubros=(snapshot.rubros_secundarios||[]).length ? snapshot.rubros_secundarios.join(', ') : (snapshot.rubro_principal||'—');
  var isoList=['9001','14001','45001'].filter(function(code){ var k='iso_'+code; return payload[k] && payload[k].enabled; }).map(function(code){ return 'ISO '+code; });
  if(r.request_type==='claim_existing'){
    return '<div class="ps80-req-grid">'
      +'<div class="ps80-req-meta"><strong>Empresa destino:</strong> '+esc((c&& (c.nombre_fantasia||c.razon_social))||'Empresa')+'</div>'
      +'<div class="ps80-req-meta"><strong>Cargo / Área:</strong> '+esc(payload.cargo||'—')+' · '+esc(payload.area||'—')+'</div>'
      +'</div>';
  }
  if(r.request_type==='company_update'){
    return '<div class="ps80-req-subtitle">Datos actualizados</div>'
      +'<div class="ps80-req-grid">'
      +'<div class="ps80-req-meta"><strong>Razón social:</strong> '+esc(snapshot.razon_social||c&&c.razon_social||'—')+'</div>'
      +'<div class="ps80-req-meta"><strong>CUIT:</strong> '+esc(snapshot.cuit||c&&c.cuit||'—')+'</div>'
      +'<div class="ps80-req-meta"><strong>Tipo societario:</strong> '+esc(snapshot.tipo_societario||'—')+'</div>'
      +'<div class="ps80-req-meta"><strong>Rubro principal:</strong> '+esc(snapshot.rubro_principal||'—')+'</div>'
      +'<div class="ps80-req-meta"><strong>Sede / bases:</strong> '+esc(snapshot.sede_central||'—')+' · '+esc((snapshot.bases_operativas||[]).join(', ')||'—')+'</div>'
      +'<div class="ps80-req-meta"><strong>Mail / teléfono:</strong> '+esc(snapshot.email_empresa||'—')+' · '+esc(snapshot.telefono_empresa||'—')+'</div>'
      +(payload.reason==='arca_update' ? '<div class="ps80-req-meta"><strong>Motivo:</strong> Se actualizó la constancia ARCA / CUIT y la empresa volvió a pendiente.</div>' : '')
      +'</div>';
  }
  return '<div class="ps80-req-subtitle">Cuestionario de empresa</div>'
    +'<div class="ps80-req-grid">'
    +'<div class="ps80-req-meta"><strong>Razón social:</strong> '+esc(payload.razon_social||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>CUIT:</strong> '+esc(payload.cuit||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Tipo societario:</strong> '+esc(payload.tipo_societario||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Rubro principal:</strong> '+esc(payload.rubro_principal||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Subrubros:</strong> '+esc(rubros||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Clasificación / empleados:</strong> '+esc(payload.clasificacion||payload.clasificacion_empleados||classification(payload.empleados_aprox||'', !!payload.operacion_internacional)||'—')+' · '+esc(payload.empleados_aprox||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Email empresa:</strong> '+esc(payload.email_empresa||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Teléfono empresa:</strong> '+esc(payload.telefono_empresa||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Sede central:</strong> '+esc(payload.sede_central||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Bases operativas:</strong> '+esc((payload.bases_operativas||[]).join(', ')||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Sitio web:</strong> '+esc(payload.sitio_web||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>Cargo solicitante:</strong> '+esc(payload.owner_cargo||payload.cargo||'—')+'</div>'
    +'<div class="ps80-req-meta"><strong>PNC:</strong> '+(payload.pnc&&payload.pnc.enabled?'Sí':'No')+'</div>'
    +'<div class="ps80-req-meta"><strong>ISO:</strong> '+esc(isoList.join(', ')||'No declaró')+'</div>'
    +'<div class="ps80-req-meta" style="grid-column:1 / -1"><strong>Descripción:</strong> '+esc(payload.descripcion||'—')+'</div>'
    +'<div class="ps80-req-meta" style="grid-column:1 / -1"><strong>DDJJ alta inicial:</strong> '+((payload.ddjj&&payload.ddjj.accepted)?('Aceptada el '+dateStr(payload.ddjj.accepted_at)):'Aceptada en el alta inicial')+'</div>'
    +'</div>';
}
function collectRequestAttachments(r){
  var payload=r.request_payload||{};
  var arr = Array.isArray(r.attachments) ? r.attachments.slice() : [];
  ['pnc','iso_9001','iso_14001','iso_45001'].forEach(function(k){
    if(payload[k] && payload[k].file && payload[k].file.path){ arr.push({ kind:k, path:payload[k].file.path, name:payload[k].file.name||k }); }
  });
  return mergeAttachments([], arr);
}
async function fetchRequestsForAdmin(){
  var client=sb(); if(!client) return {rows:[], profiles:{}, companies:{}};
  var res=await client.from('company_requests').select('*').order('created_at',{ascending:false});
  if(res.error) throw res.error;
  var rows=res.data||[];
  var userIds=[...new Set(rows.map(function(r){ return r.requester_user_id; }).filter(Boolean))];
  var companyIds=[...new Set(rows.map(function(r){ return r.target_company_id || r.approved_company_id; }).filter(Boolean))];
  var profiles=userIds.length ? await client.from('profiles').select('id,email,nombre,apellido').in('id', userIds) : {data:[]};
  var companies=companyIds.length ? await client.from('companies').select('id,razon_social,nombre_fantasia,cuit,verification_status,is_verified').in('id', companyIds) : {data:[]};
  var profMap={}, compMap={}; (profiles.data||[]).forEach(function(p){ profMap[p.id]=p; }); (companies.data||[]).forEach(function(c){ compMap[c.id]=c; });
  return {rows:rows, profiles:profMap, companies:compMap};
}
function requestDisplayName(r, c){
  var payload=r.request_payload||{};
  if(r.request_type==='claim_existing') return (c.nombre_fantasia||c.razon_social||'Empresa existente')+' · Reclamo';
  if(r.request_type==='company_update') return (c.nombre_fantasia||c.razon_social||payload.razon_social||'Empresa')+' · Actualización';
  return payload.razon_social||c.nombre_fantasia||c.razon_social||'Nueva empresa';
}
function reqCardHtml(r, profiles, companies){
  var p=profiles[r.requester_user_id]||{};
  var c=companies[r.target_company_id]||companies[r.approved_company_id]||{};
  var name=requestDisplayName(r, c);
  var st=String(r.status||'pending').toLowerCase();
  var atts=collectRequestAttachments(r);
  var attHtml = atts.length ? '<div class="ps80-req-subtitle">Adjuntos</div><div class="ps80-att">'+atts.map(function(a){ var path=a.path||a.file_url||''; var lbl=(a.kind||a.name||'adjunto').replaceAll('_',' '); return '<button class="bt bt-g bt-sm" onclick="window.PS_V80.openAttachment(\''+String(path).replace(/'/g,"\\'")+'\')">'+esc(lbl)+'</button>'; }).join('')+'</div>' : '<div class="ps80-req-subtitle">Adjuntos</div><div class="ps80-req-meta">Sin adjuntos.</div>';
  var actions='';
  if(['pending','under_review','need_more_info'].indexOf(st)!==-1){
    actions='<textarea class="ps80-note" id="ps80Note-'+r.id+'" rows="3" placeholder="Observaciones internas / mensaje al solicitante">'+esc(r.reviewer_notes||'')+'</textarea>'
      +'<div class="ps80-req-actions"><button class="bt bt-g bt-sm" onclick="window.PS_V80.reqNeedInfo(\''+r.id+'\')">Pedir más info</button><button class="bt bt-d bt-sm" onclick="window.PS_V80.reqReject(\''+r.id+'\')">Rechazar</button><button class="bt bt-p bt-sm" onclick="window.PS_V80.reqApprove(\''+r.id+'\')">Aprobar</button></div>';
  } else if(r.reviewer_notes){
    actions='<div class="ps80-req-meta"><strong>Notas revisor:</strong> '+esc(r.reviewer_notes)+'</div>';
  }
  return '<div class="ps80-req-card" data-status="'+esc(st)+'">'
    +'<div class="ps80-req-top"><div><div style="font-weight:700">'+esc(name)+'</div><div class="ps80-req-meta">'+esc((((p.nombre||'')+' '+(p.apellido||'')).trim())||p.email||'Usuario')+' · '+esc(p.email||'')+'</div></div><div>'+statusPill(st)+'</div></div>'
    +(r.requester_message?'<div class="ps80-req-meta" style="margin-top:8px"><strong>Mensaje del solicitante:</strong> '+esc(r.requester_message)+'</div>':'')
    +requestPayloadView(r, c)
    +attHtml
    +actions
    +'</div>';
}
async function fetchRequestRow(id){
  var client=sb(); if(!client) return null;
  var req=await client.from('company_requests').select('*').eq('id', id).single();
  return req.error ? null : req.data;
}
function notificationTextForRequest(action, row){
  var payload=row.request_payload||{};
  var name=(payload.company_snapshot&&payload.company_snapshot.razon_social)||payload.razon_social||'tu empresa';
  if(row.request_type==='create_new'){
    return action==='approved'
      ? {type:'company_request_approved', title:'Empresa validada', body:'La empresa '+name+' fue validada por Patagonia Source y ya puede operar con normalidad.'}
      : {type:'company_request_rejected', title:'Empresa rechazada', body:'La solicitud de la empresa '+name+' fue rechazada. Revisá el detalle para corregir la información enviada.'};
  }
  if(row.request_type==='company_update'){
    return action==='approved'
      ? {type:'company_update_approved', title:'Cambios de empresa aprobados', body:'Los cambios enviados para '+name+' fueron aprobados y la empresa vuelve a estar verificada.'}
      : {type:'company_update_rejected', title:'Cambios de empresa rechazados', body:'Los cambios enviados para '+name+' fueron rechazados. Revisá las observaciones del master admin.'};
  }
  return action==='approved'
    ? {type:'company_claim_approved', title:'Reclamo aprobado', body:'Tu reclamo de empresa fue aprobado y ya tenés acceso como owner.'}
    : {type:'company_claim_rejected', title:'Reclamo rechazado', body:'Tu reclamo de empresa fue rechazado. Revisá el detalle de la solicitud.'};
}
function setReqFilter(key){
  var dm=document.getElementById('dmMain'); if(!dm) return;
  Array.from(dm.querySelectorAll('.ps80-filterbtn')).forEach(function(b){ b.classList.toggle('on', b.dataset.filter===key); });
  Array.from(dm.querySelectorAll('.ps80-req-section')).forEach(function(sec){ var st=sec.dataset.section; sec.style.display = (key==='all' || st===key) ? '' : 'none'; });
}
async function renderAdminRequests(container){
  try{
    injectStyles();
    var pack=await fetchRequestsForAdmin();
    var rows=pack.rows, profiles=pack.profiles, companies=pack.companies;
    var pend=rows.filter(function(r){ return ['pending','under_review','need_more_info'].indexOf(String(r.status||''))!==-1; });
    var appr=rows.filter(function(r){ return String(r.status||'')==='approved'; });
    var rej=rows.filter(function(r){ return String(r.status||'')==='rejected'; });
    function section(title,key,arr){ return '<div class="ps80-req-section" data-section="'+key+'"><div class="ps80-req-title">'+title+' <span class="bdg '+(arr.length?'bdg-r':'bdg-v')+'">'+arr.length+'</span></div>'+(arr.length?arr.map(function(r){ return reqCardHtml(r, profiles, companies); }).join(''):'<div class="ps80-req-meta">Sin registros.</div>')+'</div>'; }
    container.innerHTML = '<div class="ps80-filterbar"><button class="ps80-filterbtn on" data-filter="all" onclick="window.PS_V80.setFilter(\'all\')">Todos</button><button class="ps80-filterbtn" data-filter="pending" onclick="window.PS_V80.setFilter(\'pending\')">Pendientes</button><button class="ps80-filterbtn" data-filter="approved" onclick="window.PS_V80.setFilter(\'approved\')">Aprobados</button><button class="ps80-filterbtn" data-filter="rejected" onclick="window.PS_V80.setFilter(\'rejected\')">Rechazados</button></div>' + section('Pendientes','pending',pend)+section('Aprobados','approved',appr)+section('Rechazados','rejected',rej);
  }catch(e){ console.error(e); container.innerHTML='<div class="adm-sec"><div class="adm-t">Solicitudes</div><div class="ps80-req-meta">No se pudieron cargar las solicitudes.</div></div>'; }
}
async function approveRequest(id){
  var client=sb(); if(!client) return;
  try{
    var row=await fetchRequestRow(id); if(!row) throw new Error('Solicitud no encontrada.');
    var note=(document.getElementById('ps80Note-'+id)||{}).value||null;
    var rpc=await client.rpc('approve_company_request', { p_request_id:id, p_assigned_role:'owner', p_reviewer_notes:note||null });
    if(rpc.error) throw rpc.error;
    var refreshed=await fetchRequestRow(id) || row;
    if(String(refreshed.status||'')!=='approved'){
      var updReq=await client.from('company_requests').update({ status:'approved', reviewer_notes:note||null }).eq('id',id);
      if(updReq.error) throw updReq.error;
      refreshed.status='approved';
    }
    var companyId=refreshed.approved_company_id || refreshed.target_company_id || null;
    if(companyId){ await client.from('companies').update({ verification_status:'verificado', is_verified:true }).eq('id', companyId); }
    var nt=notificationTextForRequest('approved', refreshed);
    await notifyUser(refreshed.requester_user_id, nt.type, nt.title, nt.body, 'company_requests', { request_id:refreshed.id, company_id:companyId, request_type:refreshed.request_type, status:'approved' });
    toastMsg('Solicitud aprobada y empresa verificada.');
    await syncCompanyState();
    if(typeof window.renderDash==='function') window.renderDash('requests');
    if(window.PS_HOTFIX62 && window.PS_HOTFIX62.renderMyCompany) window.PS_HOTFIX62.renderMyCompany();
    refreshBellAndDash();
  }catch(e){ console.error(e); toastMsg(e.message||'No se pudo aprobar','err'); }
}
async function rejectRequest(id){
  var client=sb(); if(!client) return;
  var reason=prompt('Motivo del rechazo:'); if(reason===null) return;
  try{
    var row=await fetchRequestRow(id); if(!row) throw new Error('Solicitud no encontrada.');
    var note=(document.getElementById('ps80Note-'+id)||{}).value||null;
    var rpc=await client.rpc('reject_company_request', { p_request_id:id, p_reason:reason, p_reviewer_notes:note||null });
    if(rpc.error) throw rpc.error;
    await client.from('company_requests').update({ status:'rejected', reviewer_notes:note||null }).eq('id',id);
    var nt=notificationTextForRequest('rejected', row);
    await notifyUser(row.requester_user_id, nt.type, nt.title, nt.body, 'company_requests', { request_id:row.id, company_id:row.target_company_id||row.approved_company_id||null, request_type:row.request_type, status:'rejected' });
    toastMsg('Solicitud rechazada.','info');
    if(typeof window.renderDash==='function') window.renderDash('requests');
    refreshBellAndDash();
  }catch(e){ console.error(e); toastMsg(e.message||'No se pudo rechazar','err'); }
}
async function needMoreInfo(id){
  var client=sb(); if(!client) return;
  var note=prompt('¿Qué información adicional necesitás pedir?'); if(note===null) return;
  try{
    var rpc=await client.rpc('request_company_request_more_info', { p_request_id:id, p_reviewer_notes:note||'' });
    if(rpc.error) throw rpc.error;
    await client.from('company_requests').update({ status:'need_more_info', reviewer_notes:note||'' }).eq('id',id);
    toastMsg('Se solicitó más información.','info');
    if(typeof window.renderDash==='function') window.renderDash('requests');
  }catch(e){ console.error(e); toastMsg(e.message||'No se pudo actualizar','err'); }
}
async function fetchUserNotifications(){
  var client=sb(), u=cur(); if(!client || !u || !u._sb_uid) return [];
  try{
    var res=await client.from('notifications').select('*').eq('user_id', u._sb_uid).order('created_at',{ascending:false}).limit(50);
    return res.error ? [] : (res.data||[]);
  }catch(e){ console.warn('[PS80] fetch notifications', e); return []; }
}
function notifUnread(n){ return !(n && (n.is_read===true || !!n.read_at)); }
function updateNotifBadge(count){
  var tabs=document.querySelector('#pg-dashboard .ds-tabs');
  if(!tabs) return;
  Array.from(tabs.querySelectorAll('.ds-tab')).forEach(function(el){
    var txt=(el.textContent||'').replace(/\d+/g,'').trim().toLowerCase();
    if(txt.indexOf('buzón de notificaciones')===0){
      el.innerHTML='Buzón de Notificaciones'+(count?'<span class="cn">'+count+'</span>':'');
    }
  });
}
async function markNotificationRead(id){
  var client=sb(); if(!client || !id) return;
  try{ await client.from('notifications').update({ is_read:true, read_at:new Date().toISOString() }).eq('id', id); }catch(e){ console.warn('[PS80] mark read', e); }
}
async function renderNotificationInbox(){
  var dm=document.getElementById('dmMain'); if(!dm) return;
  var rows=await fetchUserNotifications();
  var unread=rows.filter(notifUnread).length;
  updateNotifBadge(unread);
  if(!rows.length){ dm.innerHTML='<div class="adm-sec"><div class="adm-t">Buzón de Notificaciones</div><p style="color:var(--t3);font-size:.84rem">Todavía no tenés notificaciones.</p></div>'; return; }
  var html='<div class="adm-sec"><div class="adm-t">Buzón de Notificaciones</div>';
  rows.forEach(function(n){
    var unreadStyle=notifUnread(n)?' style="border-left:3px solid var(--ac)"':'';
    html+='<div class="ps80-notif-card"'+unreadStyle+' onclick="window.PS_V80.openNotif(\''+String(n.id).replace(/'/g,"\\'")+'\')">'
      +'<div class="ps80-notif-title">'+esc(n.title||'Notificación')+'</div>'
      +'<div class="ps80-notif-body">'+esc(n.body||'')+'</div>'
      +'<div class="ps80-notif-meta"><span>'+esc(n.category||'general')+'</span><span>'+esc(dateStr(n.created_at)||'')+'</span></div>'
      +'</div>';
  });
  html+='</div>';
  dm.innerHTML=html;
}
async function openNotif(id){
  var rows=await fetchUserNotifications();
  var n=(rows||[]).find(function(x){ return String(x.id)===String(id); });
  if(n) await markNotificationRead(id);
  await refreshBellAndDash();
}
async function updateNotificationBell(){
  var u=cur(); if(!u || !u._sb_uid) return;
  var rows=await fetchUserNotifications();
  var unread=rows.filter(notifUnread).length;
  var dot=document.querySelector('.ndot'); if(dot) dot.style.display = unread ? 'block' : 'none';
  updateNotifBadge(unread);
}
async function refreshBellAndDash(){
  await updateNotificationBell();
  var dm=document.getElementById('dmMain');
  if(dm && document.getElementById('pg-dashboard') && document.getElementById('pg-dashboard').classList.contains('on')){
    var activeTab=document.querySelector('#pg-dashboard .ds-tab.on');
    if(activeTab && (activeTab.textContent||'').toLowerCase().indexOf('notificaciones')!==-1){
      await renderNotificationInbox();
    }
  }
}
function patchRenderDash(){
  if(window.__ps80DashPatched || !window.renderDash) return;
  window.__ps80DashPatched=true;
  var _render=window.renderDash;
  window.renderDash = async function(tab){
    var u=cur();
    if(u && isMaster(u) && tab==='requests'){
      if(_render) _render('admin');
      var tabs=document.querySelector('#pg-dashboard .ds-tabs');
      if(tabs && !tabs.querySelector('[data-psreq="1"]')){
        var d=document.createElement('div'); d.className='ds-tab'; d.dataset.psreq='1'; d.textContent='Solicitudes'; d.onclick=function(){ window.renderDash('requests'); }; tabs.appendChild(d);
      }
      if(tabs){ Array.from(tabs.children).forEach(function(el){ el.classList.remove('on'); if(el.dataset.psreq==='1' || ((el.textContent||'').trim().toLowerCase()==='solicitudes')) el.classList.add('on'); }); }
      var dm=document.getElementById('dmMain'); if(dm) await renderAdminRequests(dm);
      return;
    }
    var current = tab || (u && u.role==='master' ? 'admin' : 'notifications');
    var ret = _render ? _render.apply(this, arguments) : void 0;
    if(u && !isMaster(u) && current==='notifications'){
      await renderNotificationInbox();
      await updateNotificationBell();
      return ret;
    }
    if(u && !isMaster(u)) setTimeout(updateNotificationBell, 50);
    return ret;
  };
}
function patchNotifBell(){
  if(window.__ps80BellPatched) return;
  window.__ps80BellPatched=true;
  var _orig=window.updNotifBell;
  window.updNotifBell = async function(){
    if(typeof _orig==='function') try{ _orig(); }catch(e){}
    await updateNotificationBell();
  };
}
function patchCertOpeners(){
  if(window.__ps80CertOpenersPatched) return;
  window.__ps80CertOpenersPatched=true;
  if(window.PS_CERTS){ window.PS_CERTS.openStoredCert = openStoredAny; }
}
window.PS_V80={ openAttachment:openStoredAny, reqApprove:approveRequest, reqReject:rejectRequest, reqNeedInfo:needMoreInfo, setFilter:setReqFilter, openNotif:openNotif };
function boot(){
  injectStyles();
  patchCommitArcaUpload();
  patchSaveCompanyCore();
  patchRenderMyCompany();
  patchCreateSubmitAndSuppressOnboarding();
  patchRenderDash();
  patchNotifBell();
  patchCertOpeners();
  syncCompanyState();
  refreshBellAndDash();
  setInterval(function(){ syncCompanyState(); refreshBellAndDash(); patchCertOpeners(); }, 5000);
  console.log('[PS v8.0] patch activo');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();