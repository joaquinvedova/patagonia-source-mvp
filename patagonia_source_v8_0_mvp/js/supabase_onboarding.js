(function(){
  'use strict';

  function sb(){ return window.PS_BRIDGE && window.PS_BRIDGE.supabase ? window.PS_BRIDGE.supabase() : null; }
  function cur(){ return window.CU || null; }
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])}); }
  function toastMsg(msg, type){ if(typeof toast==='function') toast(msg, type||'ok'); else alert(msg); }
  function hasCompany(u){ return !!(u && u._sb_company_id); }
  function isMaster(u){ return !!(u && u.role === 'master'); }
  function isOwner(u){ return !!(u && u._sb_member_role === 'owner'); }
  function canUseBusinessFeatures(u){ return isMaster(u) || hasCompany(u); }
  function activeStatuses(){ return ['pending','under_review','need_more_info']; }

  var _myRequests = [];
  var _myAuthz = [];
  var _booted = false;

  function injectStyles(){
    if(document.getElementById('ps-onb-style')) return;
    var css = `
      .ps-onb-overlay{position:fixed;inset:0;background:rgba(5,6,10,.72);backdrop-filter:blur(8px);z-index:4000;display:none;align-items:center;justify-content:center;padding:20px}
      .ps-onb-overlay.v{display:flex}
      .ps-onb-card{width:min(960px,100%);background:var(--bg1);border:1px solid var(--brd);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden}
      .ps-onb-head{padding:22px 24px 10px;border-bottom:1px solid var(--brd)}
      .ps-onb-title{font-family:'Barlow Condensed',sans-serif;font-size:1.5rem;font-weight:800;letter-spacing:.03em;text-transform:uppercase}
      .ps-onb-sub{font-size:.9rem;color:var(--t2);margin-top:6px;line-height:1.6}
      .ps-onb-body{padding:22px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
      .ps-onb-opt{border:1px solid var(--brd);background:var(--bg2);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px}
      .ps-onb-opt h4{font-family:'Barlow Condensed',sans-serif;font-size:1.05rem;text-transform:uppercase;letter-spacing:.04em}
      .ps-onb-opt p{font-size:.84rem;color:var(--t2);line-height:1.6;min-height:68px}
      .ps-onb-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:0 24px 22px}
      .ps-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:var(--acg);color:var(--ac);font-size:.72rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
      .ps-sheet{position:fixed;inset:0;background:rgba(5,6,10,.78);backdrop-filter:blur(8px);z-index:4100;display:none;align-items:center;justify-content:center;padding:20px}
      .ps-sheet.v{display:flex}
      .ps-sheet-card{width:min(900px,100%);max-height:90vh;overflow:auto;background:var(--bg1);border:1px solid var(--brd);border-radius:16px;padding:22px}
      .ps-sec{border-top:1px solid var(--brd);margin-top:14px;padding-top:14px}
      .ps-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .ps-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .ps-help{font-size:.76rem;color:var(--t3);margin-top:6px}
      .ps-req-row{border:1px solid var(--brd);border-radius:12px;background:var(--bg2);padding:14px;margin-bottom:10px}
      .ps-req-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start}
      .ps-req-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .ps-pill{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
      .ps-pill.pending{background:rgba(199,125,10,.12);color:var(--ac)}
      .ps-pill.under_review{background:rgba(58,143,212,.12);color:var(--blu)}
      .ps-pill.need_more_info{background:rgba(212,68,68,.12);color:#ff9b74}
      .ps-pill.approved{background:rgba(44,168,94,.12);color:var(--grn)}
      .ps-pill.rejected{background:rgba(221,68,68,.12);color:var(--red)}
      .ps-muted{color:var(--t2)}
      .ps-empty{padding:30px 16px;text-align:center;color:var(--t3)}
      .ps-rowline{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}
      .ps-rowline:last-child{border-bottom:none}
      @media (max-width: 760px){.ps-grid2,.ps-grid3{grid-template-columns:1fr}}
    `;
    var style = document.createElement('style');
    style.id = 'ps-onb-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureUI(){
    injectStyles();
    if(!document.getElementById('psOnbOverlay')){
      var wrap = document.createElement('div');
      wrap.id = 'psOnbOverlay';
      wrap.className = 'ps-onb-overlay';
      wrap.innerHTML = '<div class="ps-onb-card"><div class="ps-onb-head"><div class="ps-onb-title">Completá tu acceso empresarial</div><div class="ps-onb-sub" id="psOnbSub"></div></div><div class="ps-onb-body" id="psOnbBody"></div><div class="ps-onb-foot"><button class="bt bt-g" id="psOnbDismiss">Explorar por ahora</button><button class="bt bt-s" id="psOnbClose">Cerrar</button></div></div>';
      document.body.appendChild(wrap);
      document.getElementById('psOnbDismiss').onclick = dismissOnboarding;
      document.getElementById('psOnbClose').onclick = closeOnboarding;
    }
    if(!document.getElementById('psSheet')){
      var sheet = document.createElement('div');
      sheet.id = 'psSheet';
      sheet.className = 'ps-sheet';
      sheet.innerHTML = '<div class="ps-sheet-card"><div id="psSheetContent"></div></div>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', function(e){ if(e.target === sheet) closeSheet(); });
    }
  }

  function openOnboarding(){ ensureUI(); document.getElementById('psOnbOverlay').classList.add('v'); }
  function closeOnboarding(){ var el=document.getElementById('psOnbOverlay'); if(el) el.classList.remove('v'); }
  function openSheet(html){ ensureUI(); document.getElementById('psSheetContent').innerHTML = html; document.getElementById('psSheet').classList.add('v'); }
  function closeSheet(){ var el=document.getElementById('psSheet'); if(el) el.classList.remove('v'); }

  async function fetchMyRequests(){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_uid) return [];
    try{
      var res = await client.from('company_requests').select('*').eq('requester_user_id', u._sb_uid).order('created_at',{ascending:false});
      _myRequests = res.error ? [] : (res.data || []);
    }catch(e){ console.error('[PS Onb] fetchMyRequests', e); _myRequests = []; }
    return _myRequests;
  }

  async function fetchMyAuthorizations(){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_uid) return [];
    try{
      var email = ((u._sb_profile && u._sb_profile.email) || u.email || '').toLowerCase();
      var res = await client.from('company_email_authorizations').select('*').eq('status','pending').eq('email', email).order('created_at',{ascending:false});
      _myAuthz = res.error ? [] : (res.data || []);
    }catch(e){ console.error('[PS Onb] fetchMyAuthorizations', e); _myAuthz = []; }
    return _myAuthz;
  }

  function requestTypeLabel(t){ return t === 'claim_existing' ? 'Reclamo de empresa existente' : 'Alta de empresa nueva'; }
  function statusPill(s){ return '<span class="ps-pill '+esc(s)+'">'+esc(String(s).replaceAll('_',' '))+'</span>'; }

  function resolveCompanyName(companyId){
    if(typeof ST !== 'undefined'){
      var e = (ST.empresas||[]).find(function(x){ return x._sb_id === companyId; });
      if(e) return e.nm;
    }
    return 'Empresa';
  }

  function myActiveClaimForCompany(companyId){
    return (_myRequests||[]).find(function(r){ return r.request_type === 'claim_existing' && r.target_company_id === companyId && activeStatuses().indexOf(r.status)!==-1; }) || null;
  }
  function myActiveRequest(){ return (_myRequests||[]).find(function(r){ return activeStatuses().indexOf(r.status)!==-1; }) || null; }
  function myPendingAuthorizationForCompany(companyId){ return (_myAuthz||[]).find(function(a){ return a.company_id === companyId && a.status === 'pending'; }) || null; }

  async function dismissOnboarding(){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_uid) return closeOnboarding();
    try{
      var now = new Date().toISOString();
      await client.from('profiles').update({ onboarding_dismissed_at: now }).eq('id', u._sb_uid);
      if(u._sb_profile) u._sb_profile.onboarding_dismissed_at = now;
      toastMsg('Podés explorar como viewer independiente.','info');
    }catch(e){ console.error(e); }
    closeOnboarding();
  }

  function requestFormShell(title, subtitle, inner){
    return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:14px"><div><div class="ps-onb-title" style="font-size:1.3rem">'+esc(title)+'</div><div class="ps-onb-sub" style="margin-top:4px">'+subtitle+'</div></div><button class="bt bt-g bt-sm" onclick="window.PS_ONBOARDING.closeSheet()">Cerrar</button></div>' + inner;
  }

  async function renderOnboarding(forceOpen){
    ensureUI();
    var u = cur();
    if(!u || isMaster(u) || hasCompany(u)) return closeOnboarding();
    await Promise.all([fetchMyRequests(), fetchMyAuthorizations()]);
    var active = myActiveRequest();
    var hasAuthz = _myAuthz.length > 0;
    if(!forceOpen && u._sb_profile && u._sb_profile.onboarding_dismissed_at && !active && !hasAuthz) return closeOnboarding();

    document.getElementById('psOnbSub').innerHTML = active || hasAuthz
      ? 'Tu cuenta todavía no opera en nombre de una empresa. Podés revisar tus reclamos pendientes o activar un acceso autorizado.'
      : 'Elegí cómo querés continuar: crear una empresa nueva, reclamar una empresa existente sin owner, o explorar como viewer independiente.';

    var body = '';
    if(active){
      body += '<div class="ps-onb-opt" style="grid-column:1 / -1"><div class="ps-badge">Solicitud activa</div><h4>'+esc(requestTypeLabel(active.request_type))+'</h4><p>Estado actual: '+statusPill(active.status)+'<br><span class="ps-muted">Mientras tanto podés seguir explorando el catálogo.</span></p>';
      if(active.target_company_id) body += '<div class="ps-help">Empresa: '+esc(resolveCompanyName(active.target_company_id))+'</div>';
      if(active.reviewer_notes) body += '<div class="ps-help">Observación: '+esc(active.reviewer_notes)+'</div>';
      body += '</div>';
    }
    if(hasAuthz){
      body += '<div class="ps-onb-opt" style="grid-column:1 / -1"><div class="ps-badge">Accesos autorizados</div><h4>Tenés accesos pendientes</h4><p>Un owner autorizó tu email para incorporarte a una empresa. Activá el acceso con un click.</p>';
      _myAuthz.forEach(function(a){
        body += '<div class="ps-rowline"><span><strong>'+esc(resolveCompanyName(a.company_id))+'</strong><br><span class="ps-muted">Rol: '+esc(a.role)+' · Email autorizado: '+esc(a.email)+'</span></span><button class="bt bt-p bt-sm" onclick="window.PS_ONBOARDING.acceptAuthorization(\''+a.id+'\')">Activar acceso</button></div>';
      });
      body += '</div>';
    }
    body += '<div class="ps-onb-opt"><div class="ps-badge">Opción A</div><h4>Crear empresa</h4><p>Si tu empresa no existe en la base, solicitá el alta. Si se aprueba, tu usuario queda automáticamente como owner.</p><button class="bt bt-s" onclick="window.PS_ONBOARDING.openCreateCompanyRequest()">Registrar nueva empresa</button></div>';
    body += '<div class="ps-onb-opt"><div class="ps-badge">Opción B</div><h4>Mi empresa ya existe</h4><p>Buscá tu empresa por nombre o CUIT. Si todavía no tiene owner, vas a poder reclamarla. Si ya tiene owner, ese owner debe autorizar tu email.</p><button class="bt bt-p" onclick="window.PS_ONBOARDING.goCatalogForExisting()">Buscar empresa existente</button></div>';
    body += '<div class="ps-onb-opt"><div class="ps-badge">Opción C</div><h4>Seguir como viewer</h4><p>Podés recorrer el catálogo y perfiles públicos, pero no operar como empresa ni ver eventos hasta tener una empresa aprobada.</p><button class="bt bt-g" onclick="window.PS_ONBOARDING.dismissOnboarding()">Explorar por ahora</button></div>';
    document.getElementById('psOnbBody').innerHTML = body;
    openOnboarding();
  }

  function goCatalogForExisting(){
    closeOnboarding();
    if(typeof go==='function') go('catalog');
    toastMsg('Buscá tu empresa. Si no tiene owner, vas a ver “Reclamar empresa”. Si ya tiene owner, ese owner debe autorizar tu email.','info');
  }

  async function uploadRequestFiles(requestId, input, current){
    current = Array.isArray(current) ? current.slice() : [];
    var client = sb();
    if(!client || !input || !input.files || !input.files.length) return current;
    for(var i=0;i<input.files.length;i++){
      var file = input.files[i];
      var safe = Date.now()+'-'+String(file.name||('archivo-'+i)).replace(/[^a-zA-Z0-9._-]/g,'_');
      var path = 'company-requests/' + requestId + '/' + safe;
      var up = await client.storage.from('attachments').upload(path, file, { upsert:true });
      if(up.error) throw up.error;
      current.push({ path:path, name:file.name||safe, size:file.size||0, uploaded_at:new Date().toISOString() });
    }
    return current;
  }

  function buildRubroOptions(){
    if(typeof RUBROS === 'undefined') return '<option value="">Seleccionar...</option>';
    var opts = '<option value="">Seleccionar...</option>';
    RUBROS.forEach(function(r){ opts += '<option value="'+esc(r.n)+'">'+esc(r.n)+'</option>'; });
    return opts;
  }
  function buildSubrubroChecks(){
    if(typeof RUBROS === 'undefined') return '';
    var html='';
    RUBROS.forEach(function(r){ (r.s||[]).forEach(function(s){ html += '<label style="display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid var(--brd);border-radius:999px;background:var(--bg2);font-size:.78rem"><input type="checkbox" class="psSubrub" value="'+esc(s)+'"> '+esc(s)+'</label>'; }); });
    return html;
  }

  async function openClaimRequest(companyId, requestIdToEdit){
    await fetchMyRequests();
    var active = requestIdToEdit ? (_myRequests||[]).find(function(r){ return r.id === requestIdToEdit; }) : myActiveClaimForCompany(companyId);
    var payload = active && active.request_payload ? active.request_payload : {};
    var html = requestFormShell('Reclamar empresa', 'Si la solicitud se aprueba, tu usuario quedará como owner de esta empresa.',
      '<div class="ps-grid2">'
        +'<div><label class="fl">Empresa destino</label><input value="'+esc(resolveCompanyName(companyId))+'" disabled></div>'
        +'<div><label class="fl">Rol al aprobar</label><input value="Owner" disabled><div class="ps-help">El primer usuario aprobado pasa a ser owner obligatoriamente.</div></div>'
      +'</div>'
      +'<div class="ps-grid2 ps-sec">'
        +'<div><label class="fl">Cargo <span class="rq">*</span></label><input id="psClaimCargo" value="'+esc((payload.cargo)||'')+'" placeholder="Ej: Responsable Comercial"></div>'
        +'<div><label class="fl">Área</label><input id="psClaimArea" value="'+esc((payload.area)||'')+'" placeholder="Ej: Comercial / Operaciones"></div>'
      +'</div>'
      +'<div class="ps-sec"><label class="fl">Motivo o mensaje <span class="rq">*</span></label><textarea id="psClaimMsg" rows="3" placeholder="Contanos brevemente por qué reclamás esta empresa">'+esc((active&&active.requester_message)||'')+'</textarea></div>'
      +'<div class="ps-grid2 ps-sec">'
        +'<div><label class="fl">Teléfono de contacto</label><input id="psClaimPhone" value="'+esc((active&&active.requester_phone)||'')+'" placeholder="+54 299..."></div>'
        +'<div><label class="fl">Adjunto opcional</label><input type="file" id="psClaimFile"><div class="ps-help">Máximo 1 archivo.</div></div>'
      +'</div>'
      +'<div class="ps-sec" style="display:flex;justify-content:flex-end;gap:8px"><button class="bt bt-g" onclick="window.PS_ONBOARDING.closeSheet()">Cancelar</button><button class="bt bt-p" id="psClaimSubmit" onclick="window.PS_ONBOARDING.submitClaimRequest(\''+companyId+'\''+(requestIdToEdit?(',\''+requestIdToEdit+'\''):'')+')">Enviar reclamo</button></div>'
    );
    openSheet(html);
  }

  async function submitClaimRequest(companyId, requestIdToEdit){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_uid) return;
    var cargo = (document.getElementById('psClaimCargo').value || '').trim();
    var area  = (document.getElementById('psClaimArea').value || '').trim();
    var msg   = (document.getElementById('psClaimMsg').value || '').trim();
    var phone = (document.getElementById('psClaimPhone').value || '').trim();
    var fileInput = document.getElementById('psClaimFile');
    if(!cargo || !msg){ toastMsg('Completá cargo y motivo.','warn'); return; }
    var btn = document.getElementById('psClaimSubmit');
    if(btn){ btn.disabled=true; btn.dataset.orig = btn.textContent; btn.textContent='Enviando...'; }
    try{
      var payload = { cargo:cargo, area:area };
      var row, error;
      if(requestIdToEdit){
        var upd = await client.rpc('update_company_request_submission', {
          p_request_id: requestIdToEdit,
          p_assigned_role: 'owner',
          p_request_payload: payload,
          p_requester_message: msg,
          p_requester_phone: phone,
          p_attachments: null
        });
        if(upd.error) throw upd.error;
        var refetch = await client.from('company_requests').select('*').eq('id', requestIdToEdit).single();
        row = refetch.data; error = refetch.error;
      } else {
        var ins = await client.from('company_requests').insert({
          requester_user_id: u._sb_uid,
          request_type: 'claim_existing',
          target_company_id: companyId,
          assigned_role: 'owner',
          request_payload: payload,
          requester_message: msg,
          requester_phone: phone
        }).select('*').single();
        row = ins.data; error = ins.error;
      }
      if(error) throw error;
      var attachments = row.attachments || [];
      if(fileInput && fileInput.files && fileInput.files.length){
        attachments = await uploadRequestFiles(row.id, fileInput, attachments);
        var upd2 = await client.rpc('update_company_request_submission', {
          p_request_id: row.id,
          p_assigned_role: 'owner',
          p_request_payload: payload,
          p_requester_message: msg,
          p_requester_phone: phone,
          p_attachments: attachments
        });
        if(upd2.error) throw upd2.error;
      }
      await fetchMyRequests();
      closeSheet(); closeOnboarding();
      toastMsg('Reclamo enviado. Quedó pendiente de revisión.');
      if(typeof go==='function') go('catalog');
    } catch(e){
      console.error(e);
      toastMsg((e && e.message) || 'No se pudo enviar el reclamo','err');
    } finally {
      if(btn){ btn.disabled=false; btn.textContent = btn.dataset.orig || 'Enviar reclamo'; }
    }
  }


  function createCompanyDocInput(id, label, help){
    return '<div><label class="fl">'+label+'</label><input type="file" id="'+id+'" accept=".pdf,.png,.jpg,.jpeg"><div class="ps-help">'+(help||'PDF/JPG/PNG, máx. 5MB')+'</div></div>';
  }

  function createIsoBlock(code, title){
    return ''
      +'<div class="ps-sec">'
        +'<label style="display:flex;align-items:center;gap:8px;font-weight:700"><input type="checkbox" id="psIso'+code+'_yes"> '+title+'</label>'
        +'<div id="psIso'+code+'_fields" style="display:none;margin-top:10px">'
          +'<div class="ps-grid2">'
            +createCompanyDocInput('psIso'+code+'_file','Certificado','Subí la carátula con emisor, alcance y fechas')
            +'<div><label class="fl">Emisor / certificador</label><input id="psIso'+code+'_issuer"></div>'
          +'</div>'
          +'<div class="ps-grid2" style="margin-top:10px">'
            +'<div><label class="fl">Nº de certificado</label><input id="psIso'+code+'_number"></div>'
            +'<div><label class="fl">Alcance</label><input id="psIso'+code+'_scope"></div>'
          +'</div>'
          +'<div class="ps-grid2" style="margin-top:10px">'
            +'<div><label class="fl">Fecha de emisión</label><input type="date" id="psIso'+code+'_issued"></div>'
            +'<div><label class="fl">Fecha de vencimiento</label><input type="date" id="psIso'+code+'_expires"></div>'
          +'</div>'
        +'</div>'
      +'</div>';
  }

  function wireCreateCompanyForm(){
    var pnc = document.getElementById('psCrPNC');
    var pncWrap = document.getElementById('psCrPNCWrap');
    if(pnc && pncWrap){
      var syncPnc = function(){ pncWrap.style.display = pnc.checked ? 'block' : 'none'; };
      pnc.addEventListener('change', syncPnc); syncPnc();
    }
    ['9001','14001','45001'].forEach(function(code){
      var sw = document.getElementById('psIso'+code+'_yes');
      var box = document.getElementById('psIso'+code+'_fields');
      if(sw && box){
        var sync = function(){ box.style.display = sw.checked ? 'block' : 'none'; };
        sw.addEventListener('change', sync); sync();
      }
    });
  }

  async function uploadNamedFile(pathPrefix, requestId, inputId){
    var input = document.getElementById(inputId);
    var client = sb();
    if(!client || !input || !input.files || !input.files.length) return null;
    var file = input.files[0];
    var safe = pathPrefix + '-' + Date.now() + '-' + String(file.name||'archivo').replace(/[^a-zA-Z0-9._-]/g,'_');
    var path = 'company-requests/' + requestId + '/' + safe;
    var up = await client.storage.from('attachments').upload(path, file, { upsert:true });
    if(up.error) throw up.error;
    return { path:path, name:file.name||safe, size:file.size||0, uploaded_at:new Date().toISOString() };
  }

  async function uploadCreateCompanyDocs(requestId){
    var docs = {};
    var pncDoc = await uploadNamedFile('pnc', requestId, 'psCrPNCFile');
    if(pncDoc) docs.pnc = pncDoc;
    for (var code of ['9001','14001','45001']){
      var isoDoc = await uploadNamedFile('iso_'+code, requestId, 'psIso'+code+'_file');
      if(isoDoc) docs['iso_'+code] = isoDoc;
    }
    return docs;
  }

  function collectIsoPayload(code){
    var enabled = !!document.getElementById('psIso'+code+'_yes')?.checked;
    if(!enabled) return { enabled:false };
    return {
      enabled:true,
      issuer:(document.getElementById('psIso'+code+'_issuer')?.value||'').trim(),
      cert_number:(document.getElementById('psIso'+code+'_number')?.value||'').trim(),
      scope:(document.getElementById('psIso'+code+'_scope')?.value||'').trim(),
      issued_at:(document.getElementById('psIso'+code+'_issued')?.value||'').trim(),
      expires_at:(document.getElementById('psIso'+code+'_expires')?.value||'').trim()
    };
  }

  function openCreateCompanyRequest(){
    var html = requestFormShell('Solicitar alta de empresa', 'Si la empresa no existe y la solicitud se aprueba, tu usuario quedará automáticamente como owner.',
      '<div class="ps-grid2">'
        +'<div><label class="fl">Razón social <span class="rq">*</span></label><input id="psCrRS"></div>'
        +'<div><label class="fl">CUIT <span class="rq">*</span></label><input id="psCrCUIT" placeholder="30-12345678-9"></div>'
      +'</div>'
      +'<div class="ps-grid3 ps-sec">'
        +'<div><label class="fl">Tipo societario <span class="rq">*</span></label><select id="psCrTipo"><option value="">Seleccionar...</option><option>SRL</option><option>SA</option><option>SAS</option><option>Monotributo</option><option>Resp. Inscripto</option><option>UTE</option><option>Cooperativa</option><option>Otro</option></select></div>'
        +'<div><label class="fl">Rubro principal <span class="rq">*</span></label><select id="psCrRubro">'+buildRubroOptions()+'</select></div>'
        +'<div><label class="fl">Clasificación por empleados <span class="rq">*</span></label><select id="psCrEmployees"><option value="">Seleccionar...</option><option>Pequeña</option><option>Mediana</option><option>Grande</option><option>Multinacional</option></select></div>'
      +'</div>'
      +'<div class="ps-sec"><label class="fl">Subrubros</label><div style="display:flex;flex-wrap:wrap;gap:8px">'+buildSubrubroChecks()+'</div></div>'
      +'<div class="ps-grid2 ps-sec">'
        +'<div><label class="fl">Email empresa <span class="rq">*</span></label><input id="psCrEmail" type="email"></div>'
        +'<div><label class="fl">Teléfono empresa</label><input id="psCrTel"></div>'
      +'</div>'
      +'<div class="ps-grid2 ps-sec">'
        +'<div><label class="fl">Sede central <span class="rq">*</span></label><input id="psCrSede"></div>'
        +'<div><label class="fl">Bases operativas</label><input id="psCrBases" placeholder="Separar con coma"></div>'
      +'</div>'
      +'<div class="ps-sec"><label class="fl">Descripción</label><textarea id="psCrDesc" rows="3"></textarea></div>'
      +'<div class="ps-grid2 ps-sec">'
        +'<div><label class="fl">Sitio web</label><input id="psCrWeb" placeholder="https://..."></div>'
        +'<div><label class="fl">Cargo del solicitante</label><input id="psCrCargo" placeholder="Ej: Responsable Comercial"></div>'
      +'</div>'
      +'<div class="ps-sec">'
        +'<div class="ps-t" style="font-size:1rem">Compre Neuquino / PNC</div>'
        +'<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="psCrPNC"> Soy PNC</label>'
        +'<div id="psCrPNCWrap" style="display:none;margin-top:10px">'+createCompanyDocInput('psCrPNCFile','Constancia PNC','Subí la constancia para revisión manual')+'</div>'
      +'</div>'
      +'<div class="ps-sec">'
        +'<div class="ps-t" style="font-size:1rem">Certificaciones ISO</div>'
        +'<div class="ps-help">Si marcás una ISO, cargá el certificado y sus datos básicos.</div>'
        +createIsoBlock('9001','ISO 9001')
        +createIsoBlock('14001','ISO 14001')
        +createIsoBlock('45001','ISO 45001')
      +'</div>'
      +'<div class="ps-sec"><label class="fl">Mensaje para revisión</label><textarea id="psCrMsg" rows="3" placeholder="Contanos brevemente por qué querés sumar tu empresa"></textarea></div>'
      +'<div class="ps-grid2 ps-sec">'
        +'<div><label class="fl">Adjuntos adicionales</label><input type="file" id="psCrFiles" multiple><div class="ps-help">Hasta 3 archivos adicionales.</div></div>'
        +'<div class="ps-help" style="align-self:end">Si detectamos un CUIT ya existente, te vamos a redirigir al flujo correcto.</div>'
      +'</div>'
      +'<div class="ps-sec" style="display:flex;justify-content:flex-end;gap:8px"><button class="bt bt-g" onclick="window.PS_ONBOARDING.closeSheet()">Cancelar</button><button class="bt bt-p" id="psCreateSubmit" onclick="window.PS_ONBOARDING.submitCreateCompanyRequest()">Enviar solicitud</button></div>'
    );
    openSheet(html);
    wireCreateCompanyForm();
  }

  async function submitCreateCompanyRequest(){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_uid){
      alert('No hay sesión activa. Volvé a iniciar sesión.');
      return;
    }
    var rs = (document.getElementById('psCrRS')?.value || '').trim();
    var cuit = (document.getElementById('psCrCUIT')?.value || '').trim();
    var tipo = (document.getElementById('psCrTipo')?.value || '').trim();
    var rubro = (document.getElementById('psCrRubro')?.value || '').trim();
    var email = (document.getElementById('psCrEmail')?.value || '').trim();
    var sede = (document.getElementById('psCrSede')?.value || '').trim();
    var employees = (document.getElementById('psCrEmployees')?.value || '').trim();
    var files = document.getElementById('psCrFiles');
    if(!rs || !cuit || !tipo || !rubro || !email || !sede || !employees){
      alert('Completá razón social, CUIT, tipo societario, rubro principal, email, sede y clasificación por empleados.');
      return;
    }
    if(files && files.files && files.files.length > 3){
      alert('Máximo 3 archivos adicionales.');
      return;
    }
    var pncEnabled = !!document.getElementById('psCrPNC')?.checked;
    var pncFile = document.getElementById('psCrPNCFile');
    if(pncEnabled && (!pncFile || !pncFile.files || !pncFile.files.length)){
      alert('Marcaste PNC. Subí la constancia PNC para revisión.');
      return;
    }
    for (var code of ['9001','14001','45001']){
      var enabled = !!document.getElementById('psIso'+code+'_yes')?.checked;
      if(enabled){
        var isoFile = document.getElementById('psIso'+code+'_file');
        var issuer = (document.getElementById('psIso'+code+'_issuer')?.value || '').trim();
        var num = (document.getElementById('psIso'+code+'_number')?.value || '').trim();
        var scope = (document.getElementById('psIso'+code+'_scope')?.value || '').trim();
        var issued = (document.getElementById('psIso'+code+'_issued')?.value || '').trim();
        var expires = (document.getElementById('psIso'+code+'_expires')?.value || '').trim();
        if(!isoFile || !isoFile.files || !isoFile.files.length || !issuer || !num || !scope || !issued || !expires){
          alert('Completá archivo, emisor, número, alcance y fechas para ISO '+code+'.');
          return;
        }
      }
    }

    var btn = document.getElementById('psCreateSubmit');
    var original = btn ? btn.textContent : 'Enviar solicitud';
    if(btn){ btn.disabled=true; btn.textContent='Enviando...'; }
    try{
      var exact = await client.from('companies').select('id, razon_social').eq('cuit', cuit).limit(1);
      if(exact.error) throw exact.error;
      if(exact.data && exact.data.length){
        closeSheet(); closeOnboarding();
        var compId = exact.data[0].id;
        var emp = typeof ST !== 'undefined' ? (ST.empresas||[]).find(function(e){ return e._sb_id === compId; }) : null;
        if(emp && emp._claimed){
          alert('Ese CUIT ya existe y la empresa ya tiene owner. El owner debe autorizar tu email.');
          if(typeof go==='function') go('catalog');
          return;
        }
        alert('Ese CUIT ya existe en la base. En lugar de crearla de nuevo, podés reclamarla.');
        await openClaimRequest(compId);
        return;
      }
      var payload = {
        razon_social: rs,
        cuit: cuit,
        tipo_societario: tipo,
        rubro_principal: rubro,
        rubros_secundarios: Array.from(document.querySelectorAll('.psSubrub:checked')).map(function(el){ return el.value; }),
        email_empresa: email,
        telefono_empresa: (document.getElementById('psCrTel')?.value || '').trim(),
        sede_central: sede,
        bases_operativas: (document.getElementById('psCrBases')?.value || '').split(',').map(function(v){ return v.trim(); }).filter(Boolean),
        descripcion: (document.getElementById('psCrDesc')?.value || '').trim(),
        sitio_web: (document.getElementById('psCrWeb')?.value || '').trim(),
        cargo: (document.getElementById('psCrCargo')?.value || '').trim(),
        clasificacion_empleados: employees,
        pnc: { enabled:pncEnabled },
        iso_9001: collectIsoPayload('9001'),
        iso_14001: collectIsoPayload('14001'),
        iso_45001: collectIsoPayload('45001')
      };
      var ins = await client.from('company_requests').insert({
        requester_user_id: u._sb_uid,
        request_type: 'create_new',
        assigned_role: 'owner',
        request_payload: payload,
        requester_message: (document.getElementById('psCrMsg')?.value || '').trim(),
        requester_phone: (u._sb_profile && u._sb_profile.telefono) || u.telPersonal || ''
      }).select('*').single();
      if(ins.error) throw ins.error;
      if(!ins.data || !ins.data.id) throw new Error('La solicitud no devolvió un ID válido.');

      var attachments = ins.data.attachments || [];
      var docMap = await uploadCreateCompanyDocs(ins.data.id);
      Object.keys(docMap).forEach(function(k){ if(docMap[k]) attachments.push({ kind:k, path:docMap[k].path, name:docMap[k].name, size:docMap[k].size, uploaded_at:docMap[k].uploaded_at }); });
      if(pncEnabled && docMap.pnc) payload.pnc.file = docMap.pnc;
      if(docMap.iso_9001) payload.iso_9001.file = docMap.iso_9001;
      if(docMap.iso_14001) payload.iso_14001.file = docMap.iso_14001;
      if(docMap.iso_45001) payload.iso_45001.file = docMap.iso_45001;
      if(files && files.files && files.files.length){
        attachments = await uploadRequestFiles(ins.data.id, files, attachments);
      }

      try{
        var upd2 = await client.rpc('update_company_request_submission', {
          p_request_id: ins.data.id,
          p_assigned_role: 'owner',
          p_request_payload: payload,
          p_requester_message: (document.getElementById('psCrMsg')?.value || '').trim(),
          p_requester_phone: (u._sb_profile && u._sb_profile.telefono) || u.telPersonal || '',
          p_attachments: attachments
        });
        if(upd2.error) throw upd2.error;
      } catch(rpcErr){
        var fallback = await client.from('company_requests').update({
          request_payload: payload,
          requester_message: (document.getElementById('psCrMsg')?.value || '').trim(),
          requester_phone: (u._sb_profile && u._sb_profile.telefono) || u.telPersonal || '',
          attachments: attachments
        }).eq('id', ins.data.id);
        if(fallback.error) throw fallback.error;
      }

      await fetchMyRequests();
      closeSheet(); closeOnboarding();
      alert('Solicitud enviada correctamente. Si se aprueba, tu usuario quedará como owner.');
    }catch(e){
      console.error('[PS Onboarding] submitCreateCompanyRequest error:', e);
      alert((e && e.message) || 'No se pudo enviar la solicitud.');
    } finally {
      if(btn){ btn.disabled=false; btn.textContent = original; }
    }
  }

  async function renderMasterRequests(){
    var client = sb();
    if(!client) return;
    var dm = document.getElementById('dmMain');
    if(!dm) return;
    dm.innerHTML = '<div class="adm-sec"><div class="adm-t">Solicitudes</div><div class="ps-empty">Cargando...</div></div>';
    try{
      var rq = await client.from('company_requests').select('*').order('created_at', {ascending:false});
      if(rq.error) throw rq.error;
      var rows = rq.data || [];
      if(!rows.length){ dm.innerHTML = '<div class="adm-sec"><div class="adm-t">Solicitudes</div><div class="ps-empty">No hay solicitudes todavía.</div></div>'; return; }
      var requesterIds = Array.from(new Set(rows.map(function(r){ return r.requester_user_id; }).filter(Boolean)));
      var companyIds = Array.from(new Set(rows.map(function(r){ return r.target_company_id || r.approved_company_id; }).filter(Boolean)));
      var profiles = requesterIds.length ? await client.from('profiles').select('id,email,nombre,apellido').in('id', requesterIds) : {data:[]};
      var companies = companyIds.length ? await client.from('companies').select('id,razon_social,nombre_fantasia,cuit').in('id', companyIds) : {data:[]};
      var profMap = {}; (profiles.data||[]).forEach(function(p){ profMap[p.id] = p; });
      var companyMap = {}; (companies.data||[]).forEach(function(c){ companyMap[c.id] = c; });
      var html = '<div class="adm-sec"><div class="adm-t">Solicitudes de empresa</div><div class="ps-help" style="margin-bottom:12px">Aprobá altas nuevas o reclamos de empresas sin owner.</div>';
      rows.forEach(function(r){
        var p = profMap[r.requester_user_id] || {};
        var c = companyMap[r.target_company_id] || companyMap[r.approved_company_id] || null;
        var payload = r.request_payload || {};
        var targetLabel = r.request_type === 'claim_existing' ? (c ? (c.nombre_fantasia || c.razon_social) : 'Empresa existente') : (payload.razon_social || 'Nueva empresa');
        html += '<div class="ps-req-row">'
          +'<div class="ps-req-top"><div><div style="font-weight:700">'+esc(targetLabel)+'</div><div class="ps-muted" style="font-size:.8rem">'+esc(requestTypeLabel(r.request_type))+' · '+statusPill(r.status)+'</div></div><div class="ps-muted" style="font-size:.78rem">'+new Date(r.created_at).toLocaleString('es-AR')+'</div></div>'
          +'<div style="margin-top:10px;font-size:.84rem"><strong>Solicitante:</strong> '+esc(((p.nombre||'')+' '+(p.apellido||'')).trim() || p.email || 'Usuario')+' · '+esc(p.email || '')+'</div>'
          +(r.request_type==='claim_existing'
            ? '<div style="margin-top:6px;font-size:.82rem"><strong>Empresa destino:</strong> '+esc(targetLabel)+'</div><div style="margin-top:6px;font-size:.82rem"><strong>Cargo:</strong> '+esc((payload.cargo||''))+' · <strong>Área:</strong> '+esc((payload.area||''))+'</div>'
            : '<div style="margin-top:6px;font-size:.82rem"><strong>CUIT:</strong> '+esc(payload.cuit||'—')+' · <strong>Rubro:</strong> '+esc(payload.rubro_principal||'—')+'</div><div style="margin-top:6px;font-size:.82rem"><strong>Email empresa:</strong> '+esc(payload.email_empresa||'—')+' · <strong>Sede:</strong> '+esc(payload.sede_central||'—')+'</div><div style="margin-top:6px;font-size:.82rem"><strong>Empleados:</strong> '+esc(payload.clasificacion_empleados||'—')+' · <strong>PNC:</strong> '+(payload.pnc&&payload.pnc.enabled?'Sí':'No')+'</div><div style="margin-top:6px;font-size:.82rem"><strong>ISO:</strong> '+['9001','14001','45001'].filter(function(code){ var k='iso_'+code; return payload[k] && payload[k].enabled; }).map(function(code){ return 'ISO '+code; }).join(', ')+'</div>')
          +(r.requester_message ? '<div style="margin-top:8px;font-size:.82rem"><strong>Mensaje:</strong> '+esc(r.requester_message)+'</div>' : '')
          +(Array.isArray(r.attachments) && r.attachments.length ? '<div style="margin-top:8px;font-size:.82rem"><strong>Adjuntos:</strong> '+r.attachments.map(function(a){ return esc(a.name || a.path || 'archivo'); }).join(', ')+'</div>' : '')
          +(r.reviewer_notes ? '<div style="margin-top:8px;font-size:.82rem;color:var(--t2)"><strong>Notas revisor:</strong> '+esc(r.reviewer_notes)+'</div>' : '')
          +'<div class="ps-sec"><div class="ps-help">Rol al aprobar: <strong>owner</strong> (fijo)</div><textarea id="psNote-'+r.id+'" rows="2" placeholder="Observaciones internas">'+esc(r.reviewer_notes||'')+'</textarea></div>'
          +'<div class="ps-req-actions"><button class="bt bt-g bt-sm" onclick="window.PS_ONBOARDING.markRequestUnderReview(\''+r.id+'\')">En revisión</button><button class="bt bt-s bt-sm" onclick="window.PS_ONBOARDING.needMoreInfo(\''+r.id+'\')">Pedir más info</button><button class="bt bt-d bt-sm" onclick="window.PS_ONBOARDING.rejectRequest(\''+r.id+'\')">Rechazar</button><button class="bt bt-p bt-sm" onclick="window.PS_ONBOARDING.approveRequest(\''+r.id+'\')">Aprobar</button></div>'
        +'</div>';
      });
      html += '</div>';
      dm.innerHTML = html;
    }catch(e){ console.error(e); dm.innerHTML = '<div class="adm-sec"><div class="adm-t">Solicitudes</div><div class="ps-empty">No se pudieron cargar las solicitudes.</div></div>'; }
  }

  async function callReqRpc(fn, args){ var client = sb(); var res = await client.rpc(fn, args||{}); if(res.error) throw res.error; return res.data; }
  async function approveRequest(id){ try{ var note = document.getElementById('psNote-'+id) ? document.getElementById('psNote-'+id).value : null; await callReqRpc('approve_company_request',{ p_request_id:id, p_assigned_role:'owner', p_reviewer_notes:note||null }); toastMsg('Solicitud aprobada.'); renderDash('requests'); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo aprobar','err'); } }
  async function rejectRequest(id){ var reason=prompt('Motivo del rechazo:'); if(reason===null) return; try{ var note=document.getElementById('psNote-'+id)?document.getElementById('psNote-'+id).value:null; await callReqRpc('reject_company_request',{ p_request_id:id, p_reason:reason, p_reviewer_notes:note||null }); toastMsg('Solicitud rechazada.','info'); renderDash('requests'); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo rechazar','err'); } }
  async function markRequestUnderReview(id){ try{ var note=document.getElementById('psNote-'+id)?document.getElementById('psNote-'+id).value:null; await callReqRpc('set_company_request_under_review',{ p_request_id:id, p_reviewer_notes:note||null }); toastMsg('Solicitud marcada en revisión.','info'); renderDash('requests'); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo actualizar','err'); } }
  async function needMoreInfo(id){ var note=prompt('¿Qué información adicional necesitás pedir?'); if(note===null) return; try{ await callReqRpc('request_company_request_more_info',{ p_request_id:id, p_reviewer_notes:note||'' }); toastMsg('Se solicitó más información.','info'); renderDash('requests'); }catch(e){ console.error(e); toastMsg(e.message||'No se pudo pedir más información','err'); } }

  async function fetchCompanyMembers(companyId){
    var client = sb();
    if(!client || !companyId) return [];
    var res = await client.from('company_members').select('user_id, role, cargo, area, profiles(id,email,nombre,apellido,telefono)').eq('company_id', companyId).order('created_at');
    return res.error ? [] : (res.data || []);
  }
  async function fetchCompanyAuthorizations(companyId){
    var client = sb();
    if(!client || !companyId) return [];
    var res = await client.from('company_email_authorizations').select('*').eq('company_id', companyId).order('created_at', {ascending:false});
    return res.error ? [] : (res.data || []);
  }

  async function renderCompanyMembersPanel(container, u){
    if(!container || !u || !u._sb_company_id) return;
    var members = await fetchCompanyMembers(u._sb_company_id);
    var authz = await fetchCompanyAuthorizations(u._sb_company_id);
    var html = '<div class="ps" style="margin-top:16px"><div class="ps-t">Usuarios de la empresa</div><p style="font-size:.82rem;color:var(--t2);margin-bottom:10px">El owner administra a los demás usuarios de la empresa autorizando sus emails.</p><div style="display:grid;gap:8px">';
    if(members.length){
      members.forEach(function(m){
        var p = m.profiles || {};
        var nm = ((p.nombre||'')+' '+(p.apellido||'')).trim() || p.email || 'Usuario';
        html += '<div class="ps-rowline"><span><strong>'+esc(nm)+'</strong><br><span class="ps-muted" style="font-size:.78rem">'+esc(p.email||'')+'</span></span><span>'+esc(m.role||'member')+(m.cargo?(' · '+esc(m.cargo)):'')+'</span></div>';
      });
    } else html += '<div class="ps-empty">No hay usuarios cargados.</div>';
    html += '</div>';
    html += '<div class="ps-sec"><div class="ps-t" style="font-size:1rem">Autorizar email</div>'
      +'<p class="ps-help">Si la empresa ya tiene owner, los nuevos usuarios entran solo si el owner autoriza su email.</p>'
      +'<div class="ps-grid3"><div><label class="fl">Email</label><input id="psAuthEmail" type="email" placeholder="usuario@empresa.com"></div><div><label class="fl">Rol</label><select id="psAuthRole"><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select></div><div><label class="fl">Cargo</label><input id="psAuthCargo" placeholder="Ej: Responsable Comercial"></div></div>'
      +'<div class="ps-grid2" style="margin-top:10px"><div><label class="fl">Área</label><input id="psAuthArea" placeholder="Ej: Comercial"></div><div style="display:flex;align-items:end;justify-content:flex-end"><button class="bt bt-p" onclick="window.PS_ONBOARDING.authorizeEmail()">Autorizar email</button></div></div>'
      +'</div>';
    html += '<div class="ps-sec"><div class="ps-t" style="font-size:1rem">Emails autorizados</div>';
    if(authz.length){
      authz.forEach(function(a){
        html += '<div class="ps-rowline"><span><strong>'+esc(a.email)+'</strong><br><span class="ps-muted" style="font-size:.78rem">Rol '+esc(a.role)+' · Estado '+esc(a.status)+'</span></span>';
        html += '<span>'+(a.status==='pending' ? '<button class="bt bt-g bt-sm" onclick="window.PS_ONBOARDING.revokeAuthorization(\''+a.id+'\')">Revocar</button>' : '')+'</span></div>';
      });
    } else html += '<div class="ps-empty">No hay emails autorizados todavía.</div>';
    html += '</div></div>';
    container.insertAdjacentHTML('beforeend', html);
  }

  async function authorizeEmail(){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_company_id) return;
    var email = ((document.getElementById('psAuthEmail')||{}).value || '').trim().toLowerCase();
    var role = ((document.getElementById('psAuthRole')||{}).value || 'member').trim();
    var cargo = ((document.getElementById('psAuthCargo')||{}).value || '').trim();
    var area = ((document.getElementById('psAuthArea')||{}).value || '').trim();
    if(!email){ toastMsg('Ingresá el email a autorizar.','warn'); return; }
    try{
      var res = await client.rpc('upsert_company_email_authorization', { p_company_id: u._sb_company_id, p_email: email, p_role: role, p_cargo: cargo||null, p_area: area||null });
      if(res.error) throw res.error;
      toastMsg('Email autorizado.');
      if(typeof window.renderMyProfile === 'function') window.renderMyProfile();
    }catch(e){ console.error(e); toastMsg(e.message || 'No se pudo autorizar el email','err'); }
  }

  async function revokeAuthorization(id){
    var client = sb(); if(!client) return;
    try{ var res = await client.rpc('revoke_company_email_authorization', { p_authorization_id: id }); if(res.error) throw res.error; toastMsg('Autorización revocada.','info'); if(typeof window.renderMyProfile === 'function') window.renderMyProfile(); }
    catch(e){ console.error(e); toastMsg(e.message||'No se pudo revocar','err'); }
  }

  async function acceptAuthorization(id){
    var client = sb(); if(!client) return;
    try{
      var res = await client.rpc('accept_company_email_authorization', { p_authorization_id: id });
      if(res.error) throw res.error;
      toastMsg('Acceso activado. Se recargará tu sesión.');
      setTimeout(function(){ location.reload(); }, 500);
    }catch(e){ console.error(e); toastMsg(e.message || 'No se pudo activar el acceso','err'); }
  }

  function simplifyRegister(){
    var reg = document.getElementById('pg-register');
    if(!reg || reg.dataset.onbPatched) return;
    reg.dataset.onbPatched = '1';
    var title = reg.querySelector('h2');
    var desc = reg.querySelector('p');
    if(title) title.textContent = 'Crear cuenta';
    if(desc) desc.textContent = 'Registrate como persona. Después del login vas a poder crear una empresa, reclamar una existente sin owner o seguir como viewer independiente.';
    var tabs = reg.querySelector('.ts'); if(tabs) tabs.style.display='none';
    var fe = document.getElementById('fE'); var fi = document.getElementById('fI');
    if(fe) fe.style.display='none'; if(fi) fi.style.display='block';
    var btn = document.getElementById('regBtn'); if(btn) btn.textContent='Crear cuenta';
    var note = document.getElementById('regNote'); if(note) note.textContent='Tu cuenta se crea como usuario persona. La empresa se crea o reclama después del login.';
  }

  function patchNavigation(){
    if(window.__psOnbGoPatched) return;
    window.__psOnbGoPatched = true;
    var _go = window.go;
    window.go = function(p){
      var u = cur();
      if((p === 'events' || p === 'create-rfq') && u && !canUseBusinessFeatures(u)){
        toastMsg('Para acceder a eventos primero necesitás una empresa aprobada o ser master.','warn');
        renderOnboarding();
        return;
      }
      if(_go) return _go(p);
    };
  }

  function patchViewProfile(){
    if(window.__psOnbProfilePatched) return;
    window.__psOnbProfilePatched = true;
    var _vp = window.viewProfile;
    window.viewProfile = async function(id){
      if(_vp) _vp(id);
      var u = cur();
      if(!u || isMaster(u) || hasCompany(u)) return;
      await Promise.all([fetchMyRequests(), fetchMyAuthorizations()]);
      var e = (typeof ST !== 'undefined' ? (ST.empresas||[]).find(function(x){ return x.id===id; }) : null);
      if(!e || !e._sb_id) return;
      var acts = document.querySelector('#profContent .ph-acts');
      if(!acts) return;
      var old = acts.querySelector('.ps-link-company-btn');
      if(old) old.remove();
      var req = myActiveClaimForCompany(e._sb_id);
      var authz = myPendingAuthorizationForCompany(e._sb_id);
      if(!e._claimed){
        var b = document.createElement('button');
        b.className = req ? 'bt bt-g bt-sm ps-link-company-btn' : 'bt bt-s bt-sm ps-link-company-btn';
        b.textContent = req ? 'Reclamo enviado' : 'Reclamar empresa';
        b.disabled = !!req;
        b.onclick = function(){ if(!req) openClaimRequest(e._sb_id); };
        acts.appendChild(b);
      } else if(authz){
        var b2 = document.createElement('button');
        b2.className = 'bt bt-p bt-sm ps-link-company-btn';
        b2.textContent = 'Activar acceso';
        b2.onclick = function(){ acceptAuthorization(authz.id); };
        acts.appendChild(b2);
      } else {
        var note = document.createElement('div');
        note.className = 'ps-help ps-link-company-btn';
        note.textContent = 'Empresa administrada. Si pertenecés a ella, el owner debe autorizar tu email desde su perfil.';
        acts.appendChild(note);
      }
    };
  }

  function patchMyProfile(){
    if(window.__psOnbMyProfilePatched) return;
    window.__psOnbMyProfilePatched = true;
    var _render = window.renderMyProfile;
    var _save = window.saveMyProfile;

    window.renderMyProfile = async function(){
      var u = cur();
      if(!u) return;
      if(!isMaster(u) && !hasCompany(u)){
        await Promise.all([fetchMyRequests(), fetchMyAuthorizations()]);
        var dm = document.getElementById('myProfContent');
        if(!dm) return;
        var active = myActiveRequest();
        var h = '<div style="text-align:center;margin-bottom:20px"><div class="nav-av" style="width:50px;height:50px;font-size:1.2rem;margin:0 auto 8px">'+esc(u.init||'US')+'</div><h2 style="font-family:\'Barlow Condensed\',sans-serif;font-size:1.2rem;font-weight:800;text-transform:uppercase">'+esc(u.responsable||u.name||'Usuario')+'</h2><p style="font-size:.82rem;color:var(--t3)">'+esc(u.email)+' · Viewer independiente</p></div>';
        h += '<div class="ps"><div class="ps-t">Estado de acceso</div><p style="font-size:.84rem;color:var(--t2)">Tu cuenta existe como usuario persona. Podés explorar el catálogo, crear una empresa nueva o reclamar una empresa sin owner.</p></div>';
        h += '<div class="ps"><div class="ps-t">Datos personales</div><div class="ps-rowline"><span class="ps-muted">Nombre</span><span>'+esc(u.responsable||u.name||'—')+'</span></div><div class="ps-rowline"><span class="ps-muted">Email</span><span>'+esc(u.email||'—')+'</span></div><div class="ps-rowline"><span class="ps-muted">Teléfono</span><span>'+esc((u._sb_profile&&u._sb_profile.telefono)||u.telPersonal||'Sin informar')+'</span></div></div>';
        h += '<div class="ps"><div class="ps-t">Próximo paso</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bt bt-p" onclick="window.PS_ONBOARDING.renderOnboarding(true)">Completar onboarding</button><button class="bt bt-s" onclick="go(\'catalog\')">Ir al catálogo</button></div>';
        if(active) h += '<div class="ps-help" style="margin-top:10px">Solicitud activa: '+esc(requestTypeLabel(active.request_type))+' · '+esc(String(active.status).replaceAll('_',' '))+'</div>';
        if(_myAuthz.length){
          h += '<div class="ps-sec"><div class="ps-t" style="font-size:1rem">Accesos autorizados</div>';
          _myAuthz.forEach(function(a){ h += '<div class="ps-rowline"><span><strong>'+esc(resolveCompanyName(a.company_id))+'</strong><br><span class="ps-muted" style="font-size:.78rem">Rol '+esc(a.role)+'</span></span><button class="bt bt-p bt-sm" onclick="window.PS_ONBOARDING.acceptAuthorization(\''+a.id+'\')">Activar acceso</button></div>'; });
          h += '</div>';
        }
        h += '</div>';
        dm.innerHTML = h;
        return;
      }
      if(_render) _render();
      var dm2 = document.getElementById('myProfContent');
      if(dm2 && u._sb_company_id && (isOwner(u) || isMaster(u))){
        renderCompanyMembersPanel(dm2, u);
      }
    };

    window.saveMyProfile = async function(){
      var u = cur(), client = sb();
      if(!u) return;
      if(!isMaster(u) && !hasCompany(u)){
        try{
          if(client){
            await client.from('profiles').update({ telefono: (document.getElementById('mpTel') && document.getElementById('mpTel').value) || (u._sb_profile && u._sb_profile.telefono) || null }).eq('id', u._sb_uid);
          }
          toastMsg('Perfil actualizado.');
        }catch(e){ console.error(e); toastMsg('No se pudo guardar el perfil','err'); }
        return;
      }
      if(_save) return _save();
    };
  }

  function patchDash(){
    if(window.__psOnbDashPatched) return;
    window.__psOnbDashPatched = true;
    var _render = window.renderDash;
    window.renderDash = function(tab){
      var u = cur();
      if(u && isMaster(u) && tab === 'requests'){
        if(_render) _render('admin');
        var tabs = document.querySelector('#pg-dashboard .ds-tabs');
        if(tabs && !tabs.querySelector('[data-psreq="1"]')){
          var d = document.createElement('div');
          d.className = 'ds-tab'; d.dataset.psreq='1'; d.textContent='Solicitudes'; d.onclick=function(){ renderDash('requests'); };
          tabs.appendChild(d);
        }
        Array.from(document.querySelectorAll('#pg-dashboard .ds-tab')).forEach(function(el){ el.classList.remove('on'); if(el.dataset.psreq==='1') el.classList.add('on'); });
        renderMasterRequests();
        return;
      }
      if(_render) _render(tab);
      var tabs2 = document.querySelector('#pg-dashboard .ds-tabs');
      if(tabs2){
        if(u && isMaster(u) && !tabs2.querySelector('[data-psreq="1"]')){
          var d2 = document.createElement('div'); d2.className='ds-tab'; d2.dataset.psreq='1'; d2.textContent='Solicitudes'; d2.onclick=function(){ renderDash('requests'); }; tabs2.appendChild(d2);
        }
        Array.from(tabs2.querySelectorAll('.ds-tab')).forEach(function(el){
          var txt = (el.textContent||'').trim().toLowerCase();
          if(txt === 'mi perfil') el.remove();
          if(u && !isMaster(u) && txt === 'contactos' && !hasCompany(u)) el.remove();
        });
      }
    };
  }

  function patchAfterLogin(){
    if(window.__psOnbLoginPatched) return;
    window.__psOnbLoginPatched = true;
    var _login = window.doLogin;
    var _logout = window.doLogout;
    window.doLogin = async function(){ var r = _login && await _login.apply(this, arguments); setTimeout(function(){ if(window.CU){ try{ CU = window.CU; }catch(e){} renderOnboarding(); } }, 500); return r; };
    window.doLogout = async function(){ closeOnboarding(); closeSheet(); return _logout && _logout.apply(this, arguments); };
  }

  function ensureLegacyCU(){ if(window.CU){ try{ CU = window.CU; }catch(e){} } }

  async function boot(){
    if(_booted) return; _booted = true;
    simplifyRegister();
    patchNavigation();
    patchViewProfile();
    patchMyProfile();
    patchDash();
    patchAfterLogin();
    ensureLegacyCU();
    setTimeout(async function(){ ensureLegacyCU(); if(cur()) await renderOnboarding(); }, 1200);
  }

  window.PS_ONBOARDING = {
    renderOnboarding: renderOnboarding,
    dismissOnboarding: dismissOnboarding,
    goCatalogForExisting: goCatalogForExisting,
    openCreateCompanyRequest: openCreateCompanyRequest,
    openClaimRequest: openClaimRequest,
    submitClaimRequest: submitClaimRequest,
    submitCreateCompanyRequest: submitCreateCompanyRequest,
    approveRequest: approveRequest,
    rejectRequest: rejectRequest,
    needMoreInfo: needMoreInfo,
    markRequestUnderReview: markRequestUnderReview,
    renderMasterRequests: renderMasterRequests,
    closeSheet: closeSheet,
    authorizeEmail: authorizeEmail,
    revokeAuthorization: revokeAuthorization,
    acceptAuthorization: acceptAuthorization
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
