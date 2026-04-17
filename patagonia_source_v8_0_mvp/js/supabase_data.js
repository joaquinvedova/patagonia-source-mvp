// ═══════════════════════════════════════════════════════════════
// PATAGONIA SOURCE — SUPABASE DATA BRIDGE v1
// Sprint 2 — Conectar UI a datos reales
// ═══════════════════════════════════════════════════════════════
// Se carga DESPUÉS de supabase_bridge.js (auth).
// Hidrata ST.empresas y ST.events desde Supabase.
// Parcha renderMyProfile, saveMyProfile, renderCat, renderEvtPage.
// La UI legacy funciona sin cambios porque ST mantiene el shape esperado.
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  // ─── HELPERS ────────────────────────────────────────────────

  function sb(){ return window.PS_BRIDGE && PS_BRIDGE.supabase(); }
  function isOnline(){ return window.PS_BRIDGE && PS_BRIDGE.isOnline(); }
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])}); }

  // Track if we've hydrated
  var _hydrated = false;
  var _companyMap = {}; // numericId → supabase UUID
  var _companyUuidMap = {}; // supabase UUID → numericId

  // Status mapping: Supabase → legacy (for V4+ patches)
  var STATUS_MAP = {
    'eval_tecnica': 'tech_eval',
    'apertura_economica': 'economic',
    'adjudicado': 'closed',
    'finalizado': 'closed'
  };

  function mapStatus(sbStatus){
    return STATUS_MAP[sbStatus] || sbStatus;
  }

  // Visibility mapping: Supabase visibility → legacy type
  function mapVisibility(vis){
    return vis === 'private' ? 'closed' : 'open';
  }

  // ═══════════════════════════════════════════════════════════════
  // HYDRATE: fetch Supabase → inject into ST
  // ═══════════════════════════════════════════════════════════════

  async function hydrateCompanies(){
    var client = sb();
    if(!client) return;
    try{
      var res = await client.from('companies').select('*').order('razon_social');
      if(res.error){ console.warn('[PS Data] companies fetch error:', res.error); return; }
      var companies = res.data || [];

      // Also fetch company_members to get "responsable" for each company
      var memRes = await client.from('company_members').select('*, profiles(nombre, apellido, telefono, linkedin, email)').order('created_at');
      var members = (!memRes.error && memRes.data) ? memRes.data : [];

      // Map to legacy shape
      var empresas = companies.map(function(c, i){
        var numId = i + 1;
        _companyMap[numId] = c.id;
        _companyUuidMap[c.id] = numId;

        // Find owner member for this company
        var ownerMember = members.find(function(m){ return m.company_id === c.id && m.role === 'owner'; });
        var profile = ownerMember ? ownerMember.profiles : null;

        // Map rubro_principal to legacy rk (rubro key)
        var rk = 'prof'; // default
        if(typeof RUBROS !== 'undefined'){
          var found = RUBROS.find(function(r){
            return r.n === c.rubro_principal || r.s.some(function(s){
              return (c.rubros_secundarios || []).indexOf(s) !== -1;
            });
          });
          if(found) rk = found.k;
        }

        return {
          id: numId,
          _sb_id: c.id,
          nm: c.nombre_fantasia || c.razon_social,
          in: c.initials || (c.razon_social || 'XX').substring(0,2).toUpperCase(),
          tp: c.tipo_societario || 'Empresa',
          v: !!c.is_verified,
          rubs: (c.rubros_secundarios && c.rubros_secundarios.length) ? c.rubros_secundarios : (c.rubro_principal ? [c.rubro_principal] : []),
          desc: c.descripcion || '',
          sede: c.sede_central || '',
          bases: c.bases_operativas || [],
          r: 0, rv: 0, // ratings — will come from future reviews system
          act: c.updated_at ? new Date(c.updated_at).toLocaleDateString('es-AR') : 'Registrada',
          rk: rk,
          wk: [], // "trabaja con" — future feature
          web: c.sitio_web || '',
          cuit: c.cuit || '',
          email_empresa: c.email_empresa || '',
          telefono_empresa: c.telefono_empresa || '',
          estado_arca: c.estado_arca || 'Sin informar',
          compreNeuquino: c.certificacion_compre_neuquino || false,
          employeeRange: c.empleados_aprox || '',
          internationalOps: c.operacion_internacional || false,
          companyClass: c.clasificacion || 'Sin informar',
          // Contact info from owner member
          _claimed: !!ownerMember,
          _responsable: profile ? ((profile.nombre||'') + ' ' + (profile.apellido||'')).trim() : '',
          _cargo: ownerMember ? (ownerMember.cargo || '') : '',
          _telPersonal: profile ? (profile.telefono || '') : '',
          _linkedin: profile ? (profile.linkedin || '') : '',
          _emC: c.email_empresa || ''
        };
      });

      if(typeof ST !== 'undefined'){
        ST.empresas = empresas;
        ST.nextEmp = empresas.length + 1;
        if(typeof saveST === 'function') saveST();
      }
      console.log('[PS Data] ' + empresas.length + ' empresas cargadas');
    }catch(e){
      console.error('[PS Data] hydrateCompanies error:', e);
    }
  }

  async function hydrateEvents(){
    var client = sb();
    if(!client || !window.CU) return;
    try{
      // RLS handles visibility automatically
      var res = await client.from('events')
        .select('*, event_items(*), event_killing_factors(*), event_eval_criteria(*)')
        .order('created_at', { ascending: false });

      if(res.error){ console.warn('[PS Data] events fetch error:', res.error); return; }
      var events = res.data || [];

      // Fetch owner profiles for creator names
      var ownerIds = events.map(function(e){ return e.owner_id; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
      var profileMap = {};
      if(ownerIds.length){
        var pRes = await client.from('profiles').select('id, nombre, apellido').in('id', ownerIds);
        if(!pRes.error && pRes.data){
          pRes.data.forEach(function(p){ profileMap[p.id] = p; });
        }
      }
      // Also get company names for owners
      var companyOwnerMap = {};
      if(ownerIds.length){
        var cmRes = await client.from('company_members').select('user_id, companies(nombre_fantasia, razon_social)').in('user_id', ownerIds);
        if(!cmRes.error && cmRes.data){
          cmRes.data.forEach(function(cm){
            if(cm.companies) companyOwnerMap[cm.user_id] = cm.companies.nombre_fantasia || cm.companies.razon_social;
          });
        }
      }

      // Map to legacy shape
      var legacyEvents = events.map(function(ev){
        var profile = profileMap[ev.owner_id];
        var creatorName = companyOwnerMap[ev.owner_id]
          || (profile ? ((profile.nombre||'')+' '+(profile.apellido||'')).trim() : '')
          || 'Desconocido';

        return {
          id: ev.event_code || ev.id,
          _sb_id: ev.id,
          title: ev.title || 'Sin título',
          status: mapStatus(ev.status || 'draft'),
          type: mapVisibility(ev.visibility),
          mode: ev.mode || 'licit',
          rubro: ev.rubro || '',
          creator: creatorName,
          _sb_owner_id: ev.owner_id,
          d1: ev.fecha_inicio || '',
          d2: ev.fecha_fin || '',
          loc: ev.location || '',
          dl: ev.fecha_limite || '',
          desc: ev.description || '',
          items: (ev.event_items || [])
            .sort(function(a,b){ return (a.sort_order||0)-(b.sort_order||0); })
            .map(function(it){ return { desc:it.description, um:it.unit, qty:it.quantity, _sb_id:it.id }; }),
          kfs: (ev.event_killing_factors || [])
            .sort(function(a,b){ return (a.sort_order||0)-(b.sort_order||0); })
            .map(function(kf){ return kf.description; }),
          mx: (ev.event_eval_criteria || [])
            .sort(function(a,b){ return (a.sort_order||0)-(b.sort_order||0); })
            .map(function(m){ return { crit:m.criterion, w:m.weight, _sb_id:m.id }; }),
          suppliers: [],
          requests: [],
          qa: [],
          bids: [],
          _from_supabase: true
        };
      });

      if(typeof ST !== 'undefined'){
        // Merge: replace supabase events, keep any legacy-only events
        var sbCodes = {};
        legacyEvents.forEach(function(e){ sbCodes[e.id] = true; });
        var legacyOnly = ST.events.filter(function(e){ return !sbCodes[e.id] && !e._from_supabase; });
        ST.events = legacyEvents.concat(legacyOnly);
        if(typeof saveST === 'function') saveST();
      }
      console.log('[PS Data] ' + legacyEvents.length + ' eventos cargados');
    }catch(e){
      console.error('[PS Data] hydrateEvents error:', e);
    }
  }

  async function hydrateAll(){
    if(!isOnline()) return;
    await hydrateCompanies();
    if(window.CU) await hydrateEvents();
    _hydrated = true;
    // Re-render visible sections
    try{
      if(typeof renderRubros === 'function') renderRubros();
      if(typeof renderFeat === 'function') renderFeat();
      var catVisible = document.getElementById('pg-catalog');
      if(catVisible && catVisible.classList.contains('on') && typeof renderCat === 'function') renderCat();
      var evtVisible = document.getElementById('pg-events');
      if(evtVisible && evtVisible.classList.contains('on') && typeof renderEvtPage === 'function') renderEvtPage();
    }catch(e){}
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: renderMyProfile — reads from Supabase CU + company
  // ═══════════════════════════════════════════════════════════════

  var _origRenderMyProfile = null;

  function patchRenderMyProfile(){
    _origRenderMyProfile = window.renderMyProfile;

    window.renderMyProfile = function(){
      if(!window.CU){ return; }
      var cur = window.CU;

      // If CU has Supabase data, ensure ST.empresas has the company
      if(cur._sb_company && typeof ST !== 'undefined'){
        var emp = ST.empresas.find(function(e){ return e._sb_id === cur._sb_company_id || e.nm === cur.name; });
        if(!emp && cur._sb_company){
          // Inject company into ST.empresas so legacy render finds it
          var c = cur._sb_company;
          emp = {
            id: ST.empresas.length + 1,
            _sb_id: c.id,
            nm: c.nombre_fantasia || c.razon_social,
            in: c.initials || 'XX',
            tp: c.tipo_societario || '',
            sede: c.sede_central || '',
            desc: c.descripcion || '',
            bases: c.bases_operativas || [],
            rubs: c.rubros_secundarios || [],
            web: c.sitio_web || '',
            employeeRange: c.empleados_aprox || '',
            internationalOps: c.operacion_internacional || false,
            companyClass: c.clasificacion || '',
            compreNeuquino: c.certificacion_compre_neuquino || false,
            compreCertificateName: ''
          };
          ST.empresas.push(emp);
        }

        // Enrich CU with profile data for the form
        if(cur._sb_profile){
          var p = cur._sb_profile;
          if(!cur.telPersonal) cur.telPersonal = p.telefono || '';
          if(!cur.linkedin) cur.linkedin = p.linkedin || '';
        }
        if(cur._sb_member_cargo && !cur.rol) cur.rol = cur._sb_member_cargo;
      }

      CU = window.CU = cur;
      // Call the legacy render (V6 version)
      if(_origRenderMyProfile) _origRenderMyProfile();
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: saveMyProfile — writes to Supabase
  // ═══════════════════════════════════════════════════════════════

  var _origSaveMyProfile = null;

  function patchSaveMyProfile(){
    _origSaveMyProfile = window.saveMyProfile;

    window.saveMyProfile = async function(){
      // Call legacy save first (updates ST and CU in memory)
      if(_origSaveMyProfile) _origSaveMyProfile();

      // Then persist to Supabase
      if(!isOnline() || !window.CU || !window.CU._sb_uid) return;

      var client = sb();
      if(!client) return;

      try{
        // Update profile
        var profileUpdate = {
          nombre: (CU.responsable || CU.name || '').split(' ')[0] || '',
          apellido: (CU.responsable || '').split(' ').slice(1).join(' ') || '',
          telefono: CU.telPersonal || document.getElementById('mpTel')?.value || '',
          linkedin: CU.linkedin || document.getElementById('mpLinkedin')?.value || ''
        };
        await client.from('profiles').update(profileUpdate).eq('id', CU._sb_uid);

        // Update company if exists
        if(CU._sb_company_id){
          var companyUpdate = {
            razon_social: document.getElementById('mpRS')?.value || CU.name,
            sede_central: document.getElementById('mpSede')?.value || '',
            sitio_web: document.getElementById('mpWeb')?.value || '',
            descripcion: document.getElementById('mpDesc')?.value || '',
            bases_operativas: (document.getElementById('mpBases')?.value || '')
              .split(',').map(function(b){ return b.trim(); }).filter(function(b){ return b; }),
            empleados_aprox: document.getElementById('mpEmpRange')?.value || '',
            operacion_internacional: document.getElementById('mpIntl')?.value === 'yes',
            clasificacion: document.getElementById('mpClass')?.value || '',
            certificacion_compre_neuquino: document.getElementById('mpCN')?.value === 'si',
            email_empresa: document.getElementById('mpEmC')?.value || ''
          };
          await client.from('companies').update(companyUpdate).eq('id', CU._sb_company_id);
        }

        // Update cargo in company_members
        var newCargo = document.getElementById('mpRol')?.value || '';
        if(CU._sb_company_id && newCargo){
          await client.from('company_members')
            .update({ cargo: newCargo })
            .eq('user_id', CU._sb_uid)
            .eq('company_id', CU._sb_company_id);
        }

        // Password change via Supabase Auth
        var pw = document.getElementById('mpPw')?.value;
        if(pw && pw.length >= 6){
          var pw2 = document.getElementById('mpPw2')?.value;
          if(pw === pw2){
            await client.auth.updateUser({ password: pw });
            console.log('[PS Data] Password updated via Supabase Auth');
          }
        }

        console.log('[PS Data] Perfil guardado en Supabase');
      }catch(e){
        console.error('[PS Data] saveMyProfile Supabase error:', e);
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: renderEvtPage — ensure events are hydrated first
  // ═══════════════════════════════════════════════════════════════

  function patchRenderEvtPage(){
    var _orig = window.renderEvtPage;

    window.renderEvtPage = async function(){
      if(isOnline() && window.CU && !_hydrated){
        await hydrateEvents();
      }
      if(_orig) _orig();
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: renderCat/renderFeat — ensure companies hydrated
  // ═══════════════════════════════════════════════════════════════

  function patchRenderCat(){
    var _origCat = window.renderCat;
    var _origFeat = window.renderFeat;

    window.renderCat = async function(){
      if(isOnline() && !_hydrated){
        await hydrateCompanies();
      }
      if(_origCat) _origCat();
    };

    window.renderFeat = async function(){
      if(isOnline() && !_hydrated){
        await hydrateCompanies();
      }
      if(_origFeat) _origFeat();
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: go() — trigger hydration on navigation
  // ═══════════════════════════════════════════════════════════════

  function patchNavigation(){
    var _origGo = window.go;

    window.go = function(p){
      // Call original navigation
      if(_origGo) _origGo(p);

      // After navigation, hydrate if needed
      if(isOnline()){
        if(p === 'catalog' && !_hydrated) hydrateCompanies().then(function(){ if(typeof renderCat === 'function') renderCat(); });
        if(p === 'events' && window.CU && !_hydrated) hydrateEvents().then(function(){ if(typeof renderEvtPage === 'function') renderEvtPage(); });
        if(p === 'myprofile' && window.CU) window.renderMyProfile();
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PATCH: viewProfile — enrich with Supabase contact data
  // ═══════════════════════════════════════════════════════════════

  function patchViewProfile(){
    // The V6 patch has buildPublicProfile which reads ST.empresas + ST.users.
    // We ensure ST.users has a matching entry for each empresa with contact data.
    // This runs after hydration.
  }

  function syncUsersFromEmpresas(){
    if(typeof ST === 'undefined') return;
    (ST.empresas || []).forEach(function(emp){
      if(!emp._responsable) return;
      var existing = ST.users.find(function(u){ return u.name === emp.nm && !u.isAlias; });
      if(!existing){
        ST.users.push({
          email: emp._emC || emp.email_empresa || '',
          name: emp.nm,
          init: emp.in,
          role: 'empresa',
          status: 'active',
          responsable: emp._responsable,
          rol: emp._cargo,
          telPersonal: emp._telPersonal,
          linkedin: emp._linkedin,
          emC: emp._emC || emp.email_empresa || ''
        });
      }else{
        // Update with latest data
        existing.responsable = emp._responsable || existing.responsable;
        existing.rol = emp._cargo || existing.rol;
        existing.telPersonal = emp._telPersonal || existing.telPersonal;
        existing.linkedin = emp._linkedin || existing.linkedin;
        existing.emC = emp._emC || existing.emC;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════

  async function boot(){
    if(!isOnline()){
      console.log('[PS Data] Sin Supabase — usando datos legacy');
      return;
    }

    // Wait a tick for auth bridge to finish session restore
    await new Promise(function(r){ setTimeout(r, 300); });

    // Apply patches (must happen before hydration so patched functions are used)
    patchRenderMyProfile();
    patchSaveMyProfile();
    patchRenderEvtPage();
    patchRenderCat();
    patchNavigation();

    // Hydrate data
    await hydrateAll();

    // Sync users array for profile rendering
    syncUsersFromEmpresas();

    // Re-render current view if visible
    try{
      if(typeof renderFeat === 'function') renderFeat();
      if(typeof renderRubros === 'function') renderRubros();
    }catch(e){}

    console.log('[PS Data] Data bridge activo — ' + (ST.empresas||[]).length + ' empresas, ' + (ST.events||[]).length + ' eventos');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 100); });
  }else{
    setTimeout(boot, 100);
  }

})();
