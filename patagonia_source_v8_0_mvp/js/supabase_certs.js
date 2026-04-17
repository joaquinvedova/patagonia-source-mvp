// ═══════════════════════════════════════════════════════════════
// PATAGONIA SOURCE — CERTIFICACIONES BRIDGE v1
// Carga DESPUÉS de supabase_onboarding.js
// ═══════════════════════════════════════════════════════════════
// Sin tocar auth bridge, data bridge ni onboarding.
// Hidrata certs, parcha Mi Perfil, perfil público, cards y admin.
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  function sb(){ return window.PS_BRIDGE && PS_BRIDGE.supabase ? PS_BRIDGE.supabase() : null; }
  function cur(){ return window.CU || null; }
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])}); }
  function toastMsg(m,t){ if(typeof toast==='function') toast(m,t||'ok'); else alert(m); }
  function hasCompany(u){ return !!(u && u._sb_company_id); }
  function isMaster(u){ return !!(u && u.role==='master'); }
  function isOwnerOrAdmin(u){ return !!(u && (u._sb_member_role==='owner'||u._sb_member_role==='admin'||u.role==='master')); }
  function dateStr(d){ if(!d) return '—'; try{ return new Date(d).toLocaleDateString('es-AR'); }catch(e){ return d; } }

  var _companyCerts = {}; // company_id → [{cert_type, status, issuer, expires_at, ...}]
  var _booted = false;

  // CSS
  function injectStyles(){
    if(document.getElementById('ps-certs-style')) return;
    var s = document.createElement('style');
    s.id = 'ps-certs-style';
    s.textContent = `
      .psc-section{border-top:1px solid var(--brd);margin-top:18px;padding-top:18px}
      .psc-title{font-family:'Barlow Condensed',sans-serif;font-size:1.05rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em;margin-bottom:10px}
      .psc-block{border:1px solid var(--brd);border-radius:12px;background:var(--bg2);padding:14px;margin-bottom:12px}
      .psc-block-t{font-weight:700;font-size:.88rem;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px}
      .psc-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .psc-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
      .psc-help{font-size:.76rem;color:var(--t3);margin-top:4px}
      .psc-ok{color:var(--grn);font-weight:700;font-size:.82rem}
      .psc-warn{color:var(--ac);font-weight:600;font-size:.82rem}
      .psc-status{display:inline-flex;padding:3px 8px;border-radius:999px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
      .psc-status.verificado,.psc-status.verified{background:rgba(44,168,94,.12);color:var(--grn)}
      .psc-status.pendiente,.psc-status.pending{background:rgba(199,125,10,.12);color:var(--ac)}
      .psc-status.en_revision{background:rgba(58,143,212,.12);color:var(--blu)}
      .psc-status.suspendido,.psc-status.rejected{background:rgba(221,68,68,.12);color:var(--red)}
      .psc-status.expired{background:rgba(221,68,68,.12);color:var(--red)}
      .psc-ddjj{border:1px solid var(--brd);border-radius:12px;background:rgba(199,125,10,.04);padding:14px;font-size:.82rem;line-height:1.7;color:var(--t2);margin-bottom:12px}
      .psc-ddjj strong{color:var(--t1)}
      .psc-badge-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .psc-disclaimer{font-size:.74rem;color:var(--t3);border-top:1px solid var(--brd2);margin-top:14px;padding-top:10px;line-height:1.6}
      @media(max-width:760px){.psc-row,.psc-row3{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════
  // HYDRATE: fetch certs for companies in ST.empresas
  // ═══════════════════════════════════════════════════════════════

  async function hydrateCerts(){
    var client = sb();
    if(!client) return;
    try{
      // For each company in ST.empresas, fetch public certs
      var empresas = (typeof ST !== 'undefined' && ST.empresas) ? ST.empresas : [];
      for(var i=0; i<empresas.length; i++){
        var e = empresas[i];
        if(!e._sb_id) continue;
        var res = await client.rpc('get_company_public_certs', { p_company_id: e._sb_id });
        if(!res.error && res.data){
          _companyCerts[e._sb_id] = res.data;
          // Enrich ST.empresas entry
          e._certs = res.data;
          e._pncVerified = res.data.some(function(c){ return c.cert_type==='pnc' && c.status==='verified'; });
          e._isos = res.data.filter(function(c){ return c.cert_type.startsWith('iso_') && c.status==='verified'; });
        }
      }
      console.log('[PS Certs] Certificaciones hidratadas para ' + Object.keys(_companyCerts).length + ' empresas');
    }catch(e){ console.error('[PS Certs] hydrateCerts error:', e); }
  }

  // Fetch full certs for a specific company (owner/admin view)
  async function fetchCompanyCertsDetail(companyId){
    var client = sb();
    if(!client) return [];
    try{
      var res = await client.from('company_certifications').select('*').eq('company_id', companyId).order('created_at');
      return res.error ? [] : (res.data || []);
    }catch(e){ return []; }
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: profileHeaderBadges — add cert badges
  // ═══════════════════════════════════════════════════════════════

  function patchBadges(){
    if(window.__psCertsBadgesPatched) return;
    window.__psCertsBadgesPatched = true;
    var _orig = window.profileHeaderBadges;

    window.profileHeaderBadges = function(e){
      var base = _orig ? _orig(e) : '';
      var arr = base ? [base] : [];

      // Verification status badge (replaces old is_verified logic if present)
      var vs = e._verification_status || (e._sb_company && e._sb_company.verification_status);
      if(vs === 'verificado' && !base.includes('Verificado')){
        arr.unshift('<span class="bdg bdg-v"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>Verificado</span>');
      }

      // PNC badge (only if verified, not the old boolean check)
      if(e._pncVerified && !base.includes('PNC')){
        arr.push('<span class="bdg bdg-v">PNC Verificado</span>');
      }
      // Remove old Compre Neuquino badge if PNC not verified
      if(!e._pncVerified){
        arr = arr.map(function(b){ return b.includes('Compre Neuquino') ? '' : b; }).filter(Boolean);
      }

      // ISO badges
      (e._isos || []).forEach(function(iso){
        var label = iso.cert_type.replace('iso_','ISO ').replace('_',' ');
        var expiry = iso.expires_at ? ' · Válido hasta ' + dateStr(iso.expires_at) : '';
        arr.push('<span class="bdg bdg-v">' + esc(label) + expiry + '</span>');
      });

      return arr.join(' ');
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: buildPublicProfile — add disclaimer + enriched badges
  // ═══════════════════════════════════════════════════════════════

  function patchPublicProfile(){
    if(window.__psCertsProfilePatched) return;
    window.__psCertsProfilePatched = true;
    var _orig = window.viewProfile || window.buildPublicProfile;

    var fn = function(id){
      if(_orig) _orig(id);

      // After render, inject disclaimer and ISO details
      setTimeout(function(){
        var container = document.getElementById('profContent');
        if(!container) return;

        var e = typeof ST!=='undefined' ? (ST.empresas||[]).find(function(x){ return x.id===id; }) : null;
        if(!e) return;

        // Add ISO issuer details into societaryBlock area
        var isos = e._isos || [];
        if(isos.length){
          var isoHtml = '<div class="ps" style="margin-top:10px"><div class="ps-t">Certificaciones verificadas</div>';
          isos.forEach(function(iso){
            var label = iso.cert_type.replace('iso_','ISO ');
            isoHtml += '<div class="ps-row" style="margin-bottom:6px"><span class="ps-lbl">' + esc(label) + '</span><span class="ps-val">'
              + (iso.issuer ? esc(iso.issuer) : '') + (iso.expires_at ? ' · Válido hasta ' + dateStr(iso.expires_at) : '')
              + '</span></div>';
          });
          isoHtml += '</div>';

          // Insert before the last </div> of pg-ct
          var lastSection = container.querySelectorAll('.ps');
          if(lastSection.length){
            lastSection[lastSection.length-1].insertAdjacentHTML('afterend', isoHtml);
          }
        }

        // Add disclaimer at the bottom
        if(!container.querySelector('.psc-disclaimer')){
          container.insertAdjacentHTML('beforeend', '<div class="psc-disclaimer">La plataforma verifica CUIT y recibe declaraciones juradas. Las certificaciones ISO y PNC se muestran solo cuando se adjuntan certificados/constancias y pasan una validación mínima. Los compradores pueden solicitar información adicional por fuera de la plataforma.</div>');
        }
      }, 50);
    };

    window.viewProfile = fn;
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: mkC / buildCompanyCard — add badge to cards
  // ═══════════════════════════════════════════════════════════════

  function patchCards(){
    // The card rendering uses profileHeaderBadges indirectly through e.v
    // We update e.v based on verification_status during hydration
    // This is done in hydrateCompanyVerification below
  }

  // ═══════════════════════════════════════════════════════════════
  // HYDRATE: enrich ST.empresas with verification_status
  // ═══════════════════════════════════════════════════════════════

  async function hydrateCompanyVerification(){
    var client = sb();
    if(!client || typeof ST === 'undefined') return;
    try{
      var ids = (ST.empresas||[]).filter(function(e){ return e._sb_id; }).map(function(e){ return e._sb_id; });
      if(!ids.length) return;
      var res = await client.from('companies')
        .select('id, verification_status, cuit_constancia_url, cuit_constancia_at, ddjj_accepted_at')
        .in('id', ids);
      if(res.error) return;
      (res.data||[]).forEach(function(c){
        var emp = (ST.empresas||[]).find(function(e){ return e._sb_id === c.id; });
        if(!emp) return;
        emp._verification_status = c.verification_status || 'pendiente';
        emp._cuit_constancia_url = c.cuit_constancia_url;
        emp._cuit_loaded = !!(c.cuit_constancia_url);
        emp._ddjj_accepted = !!(c.ddjj_accepted_at);
        // Update is_verified flag used by legacy card rendering
        emp.v = (c.verification_status === 'verificado');
      });
    }catch(e){ console.error('[PS Certs] hydrateVerification error:', e); }
  }

  // ═══════════════════════════════════════════════════════════════
  // MI PERFIL: sección documental
  // ═══════════════════════════════════════════════════════════════

  var DDJJ_TEXT = 'Declaro que la información y documentos aportados son veraces y vigentes. Declaro, además, que cumplo con las obligaciones legales que resulten aplicables a mi actividad (laborales, ambientales, de seguridad e higiene, etc.). Me comprometo a presentar evidencias cuando la plataforma lo solicite y acepto que la falsedad u omisión podrá derivar en la suspensión o baja de mi perfil.';

  var CERT_TYPES = [
    { key:'pnc', label:'PNC (Compre Neuquino)', needsIsoFields:false },
    { key:'iso_9001', label:'ISO 9001', needsIsoFields:true },
    { key:'iso_14001', label:'ISO 14001', needsIsoFields:true },
    { key:'iso_45001', label:'ISO 45001', needsIsoFields:true }
  ];

  function statusLabel(s){
    return s==='verified'?'Verificado':s==='pending'?'En revisión':s==='rejected'?'Rechazado':s==='expired'?'Vencido':s||'—';
  }
  function statusCls(s){
    return s==='verified'?'verified':s==='pending'?'pending':s==='rejected'?'rejected':s==='expired'?'expired':'pendiente';
  }

  
  async function openStoredCert(path){
    var client = sb();
    if(!client || !path) return toastMsg('Archivo no disponible','warn');
    try{
      var signed = await client.storage.from('certificates').createSignedUrl(path, 60);
      if(signed.error) throw signed.error;
      if(signed.data && signed.data.signedUrl) window.open(signed.data.signedUrl, '_blank', 'noopener');
      else throw new Error('No se pudo generar el enlace temporal.');
    }catch(e){
      console.error(e);
      toastMsg(e.message || 'No se pudo abrir el archivo', 'err');
    }
  }

async function renderCertsSection(container){
    var u = cur();
    if(!u || !hasCompany(u) || !isOwnerOrAdmin(u)) return;
    var companyId = u._sb_company_id;
    var client = sb();
    if(!client) return;

    // Fetch company verification data
    var compRes = await client.from('companies')
      .select('verification_status, cuit_constancia_url, cuit_constancia_at, ddjj_accepted_at, ddjj_accepted_by, cuit')
      .eq('id', companyId).single();
    var comp = compRes.error ? {} : (compRes.data || {});

    // Fetch existing certs
    var certs = await fetchCompanyCertsDetail(companyId);
    var certMap = {};
    certs.forEach(function(c){ certMap[c.cert_type] = c; });

    var h = '<div class="psc-section"><div class="psc-title">Documentación y Certificaciones</div>';

    // ── Estado general ──
    var vs = comp.verification_status || 'pendiente';
    h += '<div class="psc-block"><div class="psc-block-t">Estado general de la empresa <span class="psc-status ' + esc(vs) + '">' + esc(vs) + '</span></div>';
    if(vs === 'verificado'){
      h += '<div class="psc-ok">✓ Tu empresa está verificada (Constancia CUIT + DDJJ).</div>';
    } else if(vs === 'suspendido'){
      h += '<div style="color:var(--red);font-size:.84rem">Tu empresa está suspendida. Contactá al administrador para regularizar.</div>';
    } else if(vs === 'en_revision'){
      h += '<div class="psc-warn">Se solicitó documentación adicional. Revisá tus notificaciones.</div>';
    } else {
      var missing = [];
      if(!comp.cuit_constancia_url) missing.push('Constancia de CUIT');
      if(!comp.ddjj_accepted_at) missing.push('Declaración Jurada');
      h += '<div class="psc-warn">Para obtener el estado VERIFICADO necesitás: ' + esc(missing.join(' + ')) + '.</div>';
    }
    h += '</div>';

    // ── Constancia CUIT ──
    h += '<div class="psc-block"><div class="psc-block-t">Constancia de CUIT' + (comp.cuit ? ' · ' + esc(comp.cuit) : '') + '</div>';
    if(comp.cuit_constancia_url){
      h += '<div class="psc-ok">✓ Constancia cargada el ' + dateStr(comp.cuit_constancia_at) + '</div>';
      h += '<div class="psc-help">Podés reemplazarla subiendo un nuevo archivo.</div>';
    } else {
      h += '<div class="psc-warn">Subí la constancia de inscripción de CUIT (PDF, JPG o PNG, máx. 5 MB).</div>';
    }
    h += '<div style="margin-top:8px"><input type="file" id="pscCuitFile" accept=".pdf,.jpg,.jpeg,.png" style="font-size:.82rem">';
    h += '<button class="bt bt-s bt-sm" style="margin-top:6px" onclick="window.PS_CERTS.uploadCuit()">Subir constancia</button></div></div>';

    // ── DDJJ ──
    h += '<div class="psc-block"><div class="psc-block-t">Declaración Jurada</div>';
    if(comp.ddjj_accepted_at){
      h += '<div class="psc-ok">✓ Aceptada el ' + dateStr(comp.ddjj_accepted_at) + '</div>';
    } else {
      h += '<div class="psc-ddjj"><strong>DECLARACIÓN JURADA</strong><br>' + esc(DDJJ_TEXT) + '</div>';
      h += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:.84rem"><input type="checkbox" id="pscDdjjCheck" style="width:auto;margin-top:3px"> Acepto la declaración jurada.</label>';
      h += '<button class="bt bt-p bt-sm" style="margin-top:8px" onclick="window.PS_CERTS.acceptDdjj()">Confirmar DDJJ</button>';
    }
    h += '</div>';

    // ── PNC + ISOs ──
    CERT_TYPES.forEach(function(ct){
      var existing = certMap[ct.key] || null;
      var switchId = 'pscSw_' + ct.key;
      var hasExisting = !!(existing && existing.status !== 'rejected');

      h += '<div class="psc-block"><div class="psc-block-t">' + esc(ct.label);
      if(existing) h += ' <span class="psc-status ' + statusCls(existing.status) + '">' + statusLabel(existing.status) + '</span>';
      h += '</div>';

      if(existing && existing.status === 'verified'){
        h += '<div class="psc-ok">✓ Verificada' + (existing.expires_at ? ' · Válido hasta ' + dateStr(existing.expires_at) : '') + '</div>';
        if(existing.issuer) h += '<div class="psc-help">Emisor: ' + esc(existing.issuer) + '</div>';
        h += '<div class="psc-help" style="margin-top:6px">Para actualizar, subí un nuevo certificado.</div>';
      } else if(existing && existing.status === 'pending'){
        h += '<div class="psc-warn">Certificado enviado, esperando revisión del administrador.</div>';
        if(existing.issuer) h += '<div class="psc-help">Emisor: ' + esc(existing.issuer) + '</div>';
      } else if(existing && existing.status === 'expired'){
        h += '<div style="color:var(--red);font-size:.84rem">El certificado está vencido. Subí el nuevo para mantener el badge.</div>';
      } else if(existing && existing.status === 'rejected'){
        h += '<div style="color:var(--red);font-size:.84rem">Rechazado' + (existing.reviewer_notes ? ': ' + esc(existing.reviewer_notes) : '') + '</div>';
      }

      if(!hasExisting || existing.status === 'expired' || existing.status === 'rejected'){
        // Show upload form
        if(!ct.needsIsoFields){
          // PNC: just file
          h += '<div style="margin-top:8px">';
          h += '<div class="psc-help" style="margin-bottom:6px">Subí la constancia PNC para mostrar el badge.</div>';
          h += '<input type="file" id="pscFile_' + ct.key + '" accept=".pdf,.jpg,.jpeg,.png" style="font-size:.82rem">';
          h += '<button class="bt bt-s bt-sm" style="margin-top:6px" onclick="window.PS_CERTS.uploadCert(\'' + ct.key + '\')">Subir constancia</button>';
          h += '</div>';
        } else {
          // ISO: full fields
          h += '<div style="margin-top:8px">';
          h += '<div class="psc-help" style="margin-bottom:8px">Para mostrar el badge ' + esc(ct.label) + ', subí el certificado (carátula con emisor, alcance y fechas).</div>';
          h += '<div class="psc-row"><div><label class="fl">Certificado <span class="rq">*</span></label><input type="file" id="pscFile_' + ct.key + '" accept=".pdf,.jpg,.jpeg,.png" style="font-size:.82rem"></div>';
          h += '<div><label class="fl">Emisor / Organismo <span class="rq">*</span></label><input id="pscIssuer_' + ct.key + '" placeholder="Ej: IRAM, TÜV, Bureau Veritas"></div></div>';
          h += '<div class="psc-row3"><div><label class="fl">Nº Certificado <span class="rq">*</span></label><input id="pscNum_' + ct.key + '"></div>';
          h += '<div><label class="fl">Emisión <span class="rq">*</span></label><input type="date" id="pscFrom_' + ct.key + '"></div>';
          h += '<div><label class="fl">Vencimiento <span class="rq">*</span></label><input type="date" id="pscTo_' + ct.key + '"></div></div>';
          h += '<div style="margin-top:8px"><label class="fl">Alcance <span class="rq">*</span></label><input id="pscScope_' + ct.key + '" placeholder="Alcance del certificado"></div>';
          h += '<button class="bt bt-s bt-sm" style="margin-top:8px" onclick="window.PS_CERTS.uploadCert(\'' + ct.key + '\')">Enviar certificado</button>';
          h += '</div>';
        }
      }
      h += '</div>';
    });

    h += '</div>'; // close psc-section
    container.insertAdjacentHTML('beforeend', h);
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIONS: upload CUIT, DDJJ, certs
  // ═══════════════════════════════════════════════════════════════

  async function uploadCuit(){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_company_id) return;
    var input = document.getElementById('pscCuitFile');
    if(!input || !input.files || !input.files[0]){ toastMsg('Seleccioná un archivo','warn'); return; }
    var file = input.files[0];
    if(file.size > 5*1024*1024){ toastMsg('El archivo no debe superar 5 MB','warn'); return; }

    try{
      var path = u._sb_company_id + '/cuit_constancia' + (file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.pdf');
      var up = await client.storage.from('certificates').upload(path, file, { upsert:true });
      if(up.error) throw up.error;
      var storedPath = path;

      var rpc = await client.rpc('upload_cuit_constancia', { p_company_id: u._sb_company_id, p_file_url: storedPath });
      if(rpc.error) throw rpc.error;

      toastMsg('Constancia de CUIT cargada. Estado: ' + (rpc.data || ''));
      if(typeof renderMyProfile === 'function') renderMyProfile();
    }catch(e){
      console.error(e);
      toastMsg('No se pudo subir la constancia: ' + (e.message||'error'), 'err');
    }
  }

  async function acceptDdjj(){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_company_id) return;
    var check = document.getElementById('pscDdjjCheck');
    if(!check || !check.checked){ toastMsg('Debés aceptar la declaración jurada','warn'); return; }

    try{
      // Capture IP (best effort)
      var ip = null;
      try{ var r = await fetch('https://api.ipify.org?format=json'); var j = await r.json(); ip = j.ip; }catch(e){}

      var rpc = await client.rpc('accept_ddjj', { p_company_id: u._sb_company_id, p_ip: ip });
      if(rpc.error) throw rpc.error;

      toastMsg('Declaración jurada aceptada. Estado: ' + (rpc.data || ''));
      if(typeof renderMyProfile === 'function') renderMyProfile();
    }catch(e){
      console.error(e);
      toastMsg('No se pudo registrar la DDJJ: ' + (e.message||'error'), 'err');
    }
  }

  async function uploadCert(certType){
    var client = sb(), u = cur();
    if(!client || !u || !u._sb_company_id) return;

    var input = document.getElementById('pscFile_' + certType);
    if(!input || !input.files || !input.files[0]){ toastMsg('Seleccioná un archivo','warn'); return; }
    var file = input.files[0];
    if(file.size > 5*1024*1024){ toastMsg('El archivo no debe superar 5 MB','warn'); return; }

    var isIso = certType.startsWith('iso_');
    var issuer='', certNum='', scope='', issuedAt=null, expiresAt=null;

    if(isIso){
      issuer = (document.getElementById('pscIssuer_'+certType)||{}).value || '';
      certNum = (document.getElementById('pscNum_'+certType)||{}).value || '';
      scope = (document.getElementById('pscScope_'+certType)||{}).value || '';
      issuedAt = (document.getElementById('pscFrom_'+certType)||{}).value || '';
      expiresAt = (document.getElementById('pscTo_'+certType)||{}).value || '';
      if(!issuer||!certNum||!scope||!issuedAt||!expiresAt){
        toastMsg('Completá todos los campos obligatorios del certificado ISO','warn');
        return;
      }
    }

    try{
      var ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.pdf';
      var path = u._sb_company_id + '/' + certType + ext;
      var up = await client.storage.from('certificates').upload(path, file, { upsert:true });
      if(up.error) throw up.error;
      var storedPath = path;

      // Upsert into company_certifications
      var row = {
        company_id: u._sb_company_id,
        cert_type: certType,
        file_url: storedPath,
        file_name: file.name,
        status: 'pending',
        issuer: issuer || null,
        cert_number: certNum || null,
        scope: scope || null,
        issued_at: issuedAt || null,
        expires_at: expiresAt || null,
        reviewer_id: null,
        reviewer_notes: null,
        reviewed_at: null,
        reminder_sent_at: null
      };

      var res = await client.from('company_certifications').upsert(row, { onConflict: 'company_id,cert_type' }).select().single();
      if(res.error) throw res.error;

      toastMsg(isIso ? 'Certificado enviado. Queda pendiente de revisión por el administrador.' : 'Constancia enviada. Queda pendiente de validación.');
      if(typeof renderMyProfile === 'function') renderMyProfile();
    }catch(e){
      console.error(e);
      toastMsg('No se pudo subir el certificado: ' + (e.message||'error'), 'err');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN PANEL: certificaciones pendientes
  // ═══════════════════════════════════════════════════════════════

  async function renderAdminCerts(container){
    var client = sb();
    if(!client || !container) return;

    try{
      var res = await client.from('company_certifications').select('*, companies(razon_social, nombre_fantasia, cuit)').order('created_at', {ascending:false});
      if(res.error) throw res.error;
      var certs = res.data || [];

      var h = '<div class="adm-sec"><div class="adm-t">Certificaciones y Documentación</div>';
      h += '<div class="psc-help" style="margin-bottom:12px">Revisá y aprobá/rechazá certificados PNC e ISO. Solo los aprobados muestran badge público.</div>';

      if(!certs.length){
        h += '<div class="ps-empty">No hay certificaciones cargadas.</div>';
      } else {
        // Pending first, then rest
        var pending = certs.filter(function(c){ return c.status==='pending'; });
        var rest = certs.filter(function(c){ return c.status!=='pending'; });

        if(pending.length){
          h += '<div style="font-weight:700;font-size:.88rem;margin-bottom:8px;color:var(--ac)">Pendientes de revisión (' + pending.length + ')</div>';
          pending.forEach(function(c){ h += certAdminCard(c); });
        }
        if(rest.length){
          h += '<div style="font-weight:700;font-size:.88rem;margin:14px 0 8px;color:var(--t2)">Historial</div>';
          rest.forEach(function(c){ h += certAdminCard(c); });
        }
      }

      // Compliance actions
      h += '<div style="margin-top:18px;border-top:1px solid var(--brd);padding-top:14px">';
      h += '<div style="font-weight:700;font-size:.88rem;margin-bottom:8px">Acciones de compliance</div>';
      h += '<div class="psc-row"><div><label class="fl">Empresa (UUID)</label><input id="pscAdmCompany" placeholder="ID de empresa"></div>';
      h += '<div><label class="fl">Descripción</label><input id="pscAdmDesc" placeholder="Motivo"></div></div>';
      h += '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">';
      h += '<button class="bt bt-s bt-sm" onclick="window.PS_CERTS.adminRequestEvidence()">Solicitar evidencia</button>';
      h += '<button class="bt bt-d bt-sm" onclick="window.PS_CERTS.adminSuspend()">Suspender empresa</button>';
      h += '<button class="bt bt-g bt-sm" onclick="window.PS_CERTS.adminRestore()">Restaurar empresa</button>';
      h += '</div></div>';

      h += '</div>';
      container.insertAdjacentHTML('beforeend', h);
    }catch(e){
      console.error('[PS Certs] renderAdminCerts error:', e);
      container.insertAdjacentHTML('beforeend', '<div class="adm-sec"><div class="adm-t">Certificaciones</div><div class="ps-empty">Error al cargar certificaciones.</div></div>');
    }
  }

  function certAdminCard(c){
    var comp = c.companies || {};
    var compName = comp.nombre_fantasia || comp.razon_social || '—';
    var label = c.cert_type.replace('iso_','ISO ').replace('pnc','PNC').toUpperCase();
    var h = '<div class="psc-block">';
    h += '<div class="psc-block-t">' + esc(label) + ' — ' + esc(compName) + ' <span class="psc-status ' + statusCls(c.status) + '">' + statusLabel(c.status) + '</span></div>';
    h += '<div style="font-size:.82rem;color:var(--t2)">';
    if(comp.cuit) h += 'CUIT: ' + esc(comp.cuit) + ' · ';
    h += 'Archivo: <button class="bt bt-g bt-sm" onclick="window.PS_CERTS.openStoredCert(\'' + esc(c.file_url) + '\')">' + esc(c.file_name||'ver archivo') + '</button>';
    if(c.issuer) h += ' · Emisor: ' + esc(c.issuer);
    if(c.cert_number) h += ' · Nº: ' + esc(c.cert_number);
    if(c.scope) h += ' · Alcance: ' + esc(c.scope);
    if(c.issued_at) h += ' · Emisión: ' + dateStr(c.issued_at);
    if(c.expires_at) h += ' · Vencimiento: ' + dateStr(c.expires_at);
    h += '</div>';
    if(c.reviewer_notes) h += '<div class="psc-help">Notas: ' + esc(c.reviewer_notes) + '</div>';

    if(c.status === 'pending'){
      h += '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">';
      h += '<button class="bt bt-p bt-sm" onclick="window.PS_CERTS.adminApprove(\'' + c.id + '\')">Aprobar</button>';
      h += '<button class="bt bt-d bt-sm" onclick="window.PS_CERTS.adminReject(\'' + c.id + '\')">Rechazar</button>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  // Admin actions
  async function adminApprove(certId){
    var client = sb(); if(!client) return;
    try{
      var res = await client.rpc('approve_certification', { p_cert_id: certId, p_notes: null });
      if(res.error) throw res.error;
      toastMsg('Certificación aprobada.');
      if(typeof renderDash === 'function') renderDash('certs');
    }catch(e){ toastMsg(e.message||'Error al aprobar','err'); }
  }

  async function adminReject(certId){
    var reason = prompt('Motivo del rechazo:');
    if(reason===null) return;
    var client = sb(); if(!client) return;
    try{
      var res = await client.rpc('reject_certification', { p_cert_id: certId, p_reason: reason });
      if(res.error) throw res.error;
      toastMsg('Certificación rechazada.','info');
      if(typeof renderDash === 'function') renderDash('certs');
    }catch(e){ toastMsg(e.message||'Error al rechazar','err'); }
  }

  async function adminRequestEvidence(){
    var client = sb(); if(!client) return;
    var compId = (document.getElementById('pscAdmCompany')||{}).value||'';
    var desc = (document.getElementById('pscAdmDesc')||{}).value||'';
    if(!compId||!desc){ toastMsg('Completá empresa y descripción','warn'); return; }
    try{
      var res = await client.rpc('request_company_evidence', { p_company_id: compId, p_description: desc });
      if(res.error) throw res.error;
      toastMsg('Evidencia solicitada.');
    }catch(e){ toastMsg(e.message||'Error','err'); }
  }

  async function adminSuspend(){
    var client = sb(); if(!client) return;
    var compId = (document.getElementById('pscAdmCompany')||{}).value||'';
    var desc = (document.getElementById('pscAdmDesc')||{}).value||'';
    if(!compId){ toastMsg('Ingresá ID de empresa','warn'); return; }
    if(!confirm('¿Suspender esta empresa?')) return;
    try{
      var res = await client.rpc('suspend_company', { p_company_id: compId, p_reason: desc||'Suspensión administrativa' });
      if(res.error) throw res.error;
      toastMsg('Empresa suspendida.');
    }catch(e){ toastMsg(e.message||'Error','err'); }
  }

  async function adminRestore(){
    var client = sb(); if(!client) return;
    var compId = (document.getElementById('pscAdmCompany')||{}).value||'';
    var desc = (document.getElementById('pscAdmDesc')||{}).value||'';
    if(!compId){ toastMsg('Ingresá ID de empresa','warn'); return; }
    try{
      var res = await client.rpc('restore_company', { p_company_id: compId, p_notes: desc||null });
      if(res.error) throw res.error;
      toastMsg('Empresa restaurada. Estado: ' + (res.data||''));
    }catch(e){ toastMsg(e.message||'Error','err'); }
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCHES: inject into existing render flows
  // ═══════════════════════════════════════════════════════════════

  function patchMyProfile(){
    if(window.__psCertsMyProfilePatched) return;
    window.__psCertsMyProfilePatched = true;

    var _render = window.renderMyProfile;
    window.renderMyProfile = async function(){
      // Call the existing chain (V6 → onboarding → ...)
      if(_render) await _render();

      // If user has company and is owner/admin, inject certs section
      var u = cur();
      if(!u || !hasCompany(u) || !isOwnerOrAdmin(u)) return;
      var container = document.getElementById('myProfContent');
      if(!container) return;

      // Don't duplicate
      if(container.querySelector('.psc-section')) return;

      await renderCertsSection(container);
    };
  }

  function patchDashboard(){
    if(window.__psCertsDashPatched) return;
    window.__psCertsDashPatched = true;

    var _render = window.renderDash;
    window.renderDash = async function(tab){
      var u = cur();

      if(u && isMaster(u) && tab === 'certs'){
        // Render base admin first
        if(_render) _render('admin');

        // Add certs tab button
        var tabs = document.querySelector('#pg-dashboard .ds-tabs');
        if(tabs && !tabs.querySelector('[data-pscerts="1"]')){
          var d = document.createElement('div');
          d.className = 'ds-tab'; d.dataset.pscerts='1'; d.textContent='Certificaciones';
          d.onclick = function(){ renderDash('certs'); };
          tabs.appendChild(d);
        }
        Array.from(document.querySelectorAll('#pg-dashboard .ds-tab')).forEach(function(el){
          el.classList.remove('on');
          if(el.dataset.pscerts==='1') el.classList.add('on');
        });

        var dm = document.getElementById('dmMain');
        if(dm){
          dm.innerHTML = '';
          await renderAdminCerts(dm);
        }
        return;
      }

      if(_render) _render(tab);

      // Ensure certs tab exists for master
      if(u && isMaster(u)){
        var tabs2 = document.querySelector('#pg-dashboard .ds-tabs');
        if(tabs2 && !tabs2.querySelector('[data-pscerts="1"]')){
          var d2 = document.createElement('div');
          d2.className = 'ds-tab'; d2.dataset.pscerts='1'; d2.textContent='Certificaciones';
          d2.onclick = function(){ renderDash('certs'); };
          tabs2.appendChild(d2);
        }
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════

  async function boot(){
    if(_booted) return; _booted = true;
    injectStyles();
    patchBadges();
    patchPublicProfile();
    patchMyProfile();
    patchDashboard();

    // Wait for data bridge to hydrate first
    await new Promise(function(r){ setTimeout(r, 800); });

    if(sb()){
      await hydrateCompanyVerification();
      await hydrateCerts();
      // Re-render if views are open
      try{
        if(typeof renderFeat === 'function') renderFeat();
        var catOpen = document.getElementById('pg-catalog');
        if(catOpen && catOpen.classList.contains('on') && typeof renderCat === 'function') renderCat();
      }catch(e){}
    }

    console.log('[PS Certs] Bridge activo');
  }

  window.PS_CERTS = {
    uploadCuit: uploadCuit,
    acceptDdjj: acceptDdjj,
    uploadCert: uploadCert,
    adminApprove: adminApprove,
    adminReject: adminReject,
    adminRequestEvidence: adminRequestEvidence,
    adminSuspend: adminSuspend,
    adminRestore: adminRestore,
    openStoredCert: openStoredCert
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 200); });
  else setTimeout(boot, 200);

})();
