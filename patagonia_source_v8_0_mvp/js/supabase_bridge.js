// ═══════════════════════════════════════════════════════════════
// PATAGONIA SOURCE — SUPABASE AUTH BRIDGE v4
// Sprint 1 Parte B — Auth real (producción)
// ═══════════════════════════════════════════════════════════════
// MODO PRODUCCIÓN: login/registro solo vía Supabase Auth.
// Sin fallback a localStorage. Sin persistencia de contraseñas.
// El fallback legacy solo se activa si PS_CONFIG.DEBUG_MODE = true.
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  var sb = null;
  var SB_READY = false;
  var DEBUG_MODE = false;

  function initSupabase(){
    if(typeof PS_CONFIG === 'undefined' || !PS_CONFIG || !PS_CONFIG.SUPABASE_URL){
      console.error('[PS Auth] SUPABASE_URL no configurada. La app requiere Supabase.');
      return;
    }
    DEBUG_MODE = !!(PS_CONFIG.DEBUG_MODE);
    try{
      var createClient = window.supabase && window.supabase.createClient;
      if(!createClient){
        console.error('[PS Auth] Supabase SDK no cargado.');
        return;
      }
      sb = createClient(PS_CONFIG.SUPABASE_URL, PS_CONFIG.SUPABASE_ANON_KEY);
      SB_READY = true;
      console.log('[PS Auth] Supabase conectado' + (DEBUG_MODE ? ' (DEBUG — fallback legacy activo)' : ''));
    }catch(e){
      console.error('[PS Auth] Init error:', e);
    }
  }

  // ─── UI HELPERS ─────────────────────────────────────────────

  function updateNavUI(user){
    var nOut = document.getElementById('nOut');
    var nIn  = document.getElementById('nIn');
    if(nOut) nOut.style.display = user ? 'none' : '';
    if(nIn)  nIn.style.display  = user ? 'flex' : 'none';
    if(user){
      var nm = document.getElementById('uNm');
      var av = document.getElementById('uAv');
      var ab = document.getElementById('uAB');
      if(nm) nm.textContent = user.responsable || user.name || '';
      if(av) av.textContent = user.init || 'XX';
      if(ab) ab.style.display = user.role === 'master' ? 'inline' : 'none';
    }
  }

  function setButtonLoading(btn, loading){
    if(!btn) return;
    if(loading){
      btn._origText = btn.textContent;
      btn.textContent = 'Procesando...';
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }else{
      btn.textContent = btn._origText || 'Ingresar';
      btn.disabled = false;
      btn.style.opacity = '';
    }
  }

  // ─── LOAD PROFILE FROM SUPABASE ─────────────────────────────

  async function loadSupabaseUser(authUser){
    if(!sb || !authUser) return null;
    try{
      var pRes = await sb.from('profiles').select('*').eq('id', authUser.id).single();
      if(pRes.error){ console.warn('[PS Auth] Profile no encontrado:', pRes.error.message); return null; }
      var profile = pRes.data;

      var company = null, member = null;
      var mRes = await sb.from('company_members').select('*, companies(*)').eq('user_id', authUser.id).limit(1);
      if(!mRes.error && mRes.data && mRes.data.length > 0){
        member = mRes.data[0];
        company = mRes.data[0].companies;
      }

      var name = company
        ? (company.nombre_fantasia || company.razon_social)
        : ((profile.nombre || '') + ' ' + (profile.apellido || '')).trim();
      if(!name) name = authUser.email.split('@')[0];

      var init = company
        ? (company.initials || name.substring(0,2).toUpperCase())
        : name.substring(0,2).toUpperCase();

      var role = profile.rol_global === 'master' ? 'master'
        : (company ? 'empresa' : 'independiente');

      return {
        email: authUser.email,
        name: name,
        init: init,
        role: role,
        status: 'active',
        responsable: ((profile.nombre || '') + ' ' + (profile.apellido || '')).trim() || name,
        rol: member ? (member.cargo || '') : '',
        _sb_uid: authUser.id,
        _sb_company_id: company ? company.id : null,
        _sb_profile: profile,
        _sb_company: company,
        _sb_member_role: member ? (member.role || '') : null,
        _sb_member_area: member ? (member.area || '') : null,
        _sb_member_cargo: member ? (member.cargo || '') : null
      };
    }catch(e){
      console.error('[PS Auth] loadUser error:', e);
      return null;
    }
  }

  // ─── LEGACY FALLBACK (solo DEBUG_MODE) ──────────────────────

  function legacyLogin(email, password){
    if(!DEBUG_MODE) return false;
    if(typeof loadST !== 'function' || typeof ST === 'undefined') return false;
    loadST();
    var u = ST.users.find(function(x){
      return x.email === email && x.pw === password && x.status === 'active';
    });
    if(!u) return false;
    CU = window.CU = u;
    updateNavUI(u);
    console.log('[PS Auth] Login via legacy (DEBUG)');
    return true;
  }

  // ─── PATCH: doLogin ─────────────────────────────────────────

  window.doLogin = async function(){
    var em = (document.getElementById('lEm').value || '').trim();
    var pw = document.getElementById('lPw').value || '';
    if(!em || !pw){ toast('Completá email y contraseña', 'warn'); return; }

    var btn = document.querySelector('#loginMo .bt-p');
    setButtonLoading(btn, true);

    var ok = false;

    if(SB_READY){
      try{
        var res = await sb.auth.signInWithPassword({email: em, password: pw});
        if(!res.error && res.data && res.data.user){
          var cu = await loadSupabaseUser(res.data.user);
          if(cu){
            CU = window.CU = cu;
            updateNavUI(cu);
            try{ localStorage.setItem('ps_session', JSON.stringify({email:em, sb:true})); }catch(e){}
            ok = true;
            console.log('[PS Auth] Login OK:', cu.name, '(' + cu.role + ')');
          }else{
            toast('Tu cuenta existe pero no tiene perfil asociado. Contactá al administrador.', 'err');
            try{ await sb.auth.signOut(); }catch(e){}
            setButtonLoading(btn, false);
            return;
          }
        }
        if(!ok && res.error) console.warn('[PS Auth] Supabase:', res.error.message);
      }catch(e){
        console.warn('[PS Auth] Login error:', e);
      }
    }

    if(!ok && DEBUG_MODE) ok = legacyLogin(em, pw);

    setButtonLoading(btn, false);

    if(ok){
      clMo('loginMo');
      toast('Bienvenido, ' + (window.CU.responsable || window.CU.name));
      if(typeof updNotifBell === 'function') updNotifBell();
    }else if(!SB_READY){
      toast('Servicio no disponible. Verificá tu conexión.', 'err');
    }else{
      toast('Credenciales incorrectas o cuenta no aprobada', 'err');
    }
  };

  // ─── PATCH: doLogout ────────────────────────────────────────

  window.doLogout = async function(){
    if(SB_READY && sb){ try{ await sb.auth.signOut(); }catch(e){} }
    CU = window.CU = null;
    try{ localStorage.removeItem('ps_session'); }catch(e){}
    updateNavUI(null);
    toast('Sesión cerrada');
    go('home');
  };

  // ─── PATCH: submitReg ───────────────────────────────────────

  window.submitReg = async function(){
    var em = (document.getElementById('rEm').value || '').trim();
    var pw = document.getElementById('rPw').value || '';
    if(!em || !pw){ toast('Completá email y contraseña', 'warn'); return; }
    if(pw.length < 6){ toast('La contraseña debe tener al menos 6 caracteres', 'warn'); return; }
    if(!document.getElementById('termsCheck').checked){
      toast('Debés aceptar los Términos y Condiciones', 'warn'); return;
    }
    if(!SB_READY){
      toast('Servicio no disponible. Intentá más tarde.', 'err'); return;
    }

    var isEmp = document.getElementById('fE').style.display !== 'none';
    var nombre = isEmp ? (document.getElementById('rNombre')?.value||'') : (document.getElementById('rNom')?.value||'');
    var apellido = isEmp ? (document.getElementById('rApellido')?.value||'') : (document.getElementById('rApe')?.value||'');
    var fullName = nombre && apellido ? nombre+' '+apellido : (nombre||apellido||em.split('@')[0]);
    var rs = document.getElementById('rRS')?.value || '';
    var rubs = [];
    document.querySelectorAll('#regCh .fch.sel').forEach(function(c){ rubs.push(c.textContent); });

    // Entry SIN password
    var entry = {
      email:em,
      name: isEmp ? (rs||fullName) : fullName,
      init: (isEmp ? (rs||fullName) : fullName).substring(0,2).toUpperCase(),
      role: isEmp ? 'empresa' : 'independiente',
      responsable: fullName,
      rol: isEmp ? (document.getElementById('rRol')?.value||'') : (document.getElementById('rRolInd')?.value||''),
      area: document.getElementById('rArea')?.value||'',
      telPersonal: isEmp ? (document.getElementById('rTelPers')?.value||'') : (document.getElementById('rTelInd')?.value||''),
      linkedin: document.getElementById('rLinkedin')?.value||'',
      cuit: document.getElementById('rCUIT')?.value||document.getElementById('rDNI')?.value||'',
      tp: document.getElementById('rTp')?.value||'Independiente',
      sede: document.getElementById('rSede')?.value||document.getElementById('rLocInd')?.value||'',
      bases: document.getElementById('rBases')?.value||'',
      size: document.getElementById('rSize')?.value||'',
      web: document.getElementById('rWeb')?.value||'',
      desc: document.getElementById('rDesc')?.value||'',
      rubs: rubs,
      tel: document.getElementById('rTel')?.value||'',
      emC: document.getElementById('rEmC')?.value||'',
      empInd: document.getElementById('rEmpInd')?.value||'',
      useCase: document.getElementById('rUseInd')?.value||'',
      howFound: document.getElementById('rHow')?.value||'',
      date: new Date().toLocaleDateString('es-AR'),
      termsAccepted: true
    };

    var btn = document.getElementById('regBtn');
    setButtonLoading(btn, true);

    try{
      // ── 1. Crear usuario en Supabase Auth ──
      var signUpRes = await sb.auth.signUp({
        email: em, password: pw,
        options: { data: { nombre:nombre, apellido:apellido, full_name:fullName, is_empresa:isEmp, razon_social:rs } }
      });

      if(signUpRes.error){
        setButtonLoading(btn, false);
        if(signUpRes.error.message.includes('already registered') || signUpRes.error.message.includes('already been registered')){
          toast('Este email ya está registrado', 'warn');
        }else{
          toast('Error al registrar: ' + signUpRes.error.message, 'err');
        }
        return;
      }

      var authUser = signUpRes.data.user;
      var session = signUpRes.data.session;

      // ── 2. ¿Requiere confirmación de email? ──
      // session === null → confirmación requerida
      // session !== null → auto-confirmado
      var needsConfirmation = !session;

      // ── 3A. EMPRESA → siempre pending ──
      if(isEmp){
        try{
          await sb.from('registration_requests').insert({
            email: em, type: 'empresa', data: entry, status: 'pending'
          });
        }catch(e){ console.warn('[PS Auth] reg_request insert:', e); }

        setButtonLoading(btn, false);
        toast(needsConfirmation
          ? 'Revisá tu email para confirmar la cuenta. Tu solicitud de empresa será revisada por el administrador.'
          : 'Solicitud enviada. El administrador debe aprobar tu cuenta de empresa.');
        setTimeout(function(){ go('home'); }, 2000);
        return;
      }

      // ── 3B. INDEPENDIENTE ──
      if(needsConfirmation){
        setButtonLoading(btn, false);
        toast('¡Registro exitoso! Revisá tu email para confirmar la cuenta. Una vez confirmada, podrás ingresar.');
        setTimeout(function(){ go('home'); }, 2500);
        return;
      }

      // Auto-login (email confirmation desactivada)
      try{
        await sb.from('profiles').update({
          nombre: nombre, apellido: apellido,
          telefono: entry.telPersonal, linkedin: entry.linkedin
        }).eq('id', authUser.id);
      }catch(e){}

      var cu = await loadSupabaseUser(authUser);
      if(cu){
        CU = window.CU = cu;
        updateNavUI(cu);
        try{ localStorage.setItem('ps_session', JSON.stringify({email:em, sb:true})); }catch(e){}
        setButtonLoading(btn, false);
        toast('¡Bienvenido/a, ' + cu.name + '! Tu cuenta está activa.');
        setTimeout(function(){ go('home'); }, 800);
        return;
      }

      setButtonLoading(btn, false);
      toast('Cuenta creada. Iniciá sesión para continuar.');
      setTimeout(function(){ go('home'); }, 1200);

    }catch(e){
      console.error('[PS Auth] Register error:', e);
      setButtonLoading(btn, false);
      toast('Error inesperado al registrar. Intentá de nuevo.', 'err');
    }
  };

  // ─── SESSION RESTORE ────────────────────────────────────────

  async function restoreSession(){
    if(!SB_READY) return;
    try{
      var sessRes = await sb.auth.getSession();
      if(!sessRes.data || !sessRes.data.session || !sessRes.data.session.user) return;
      var cu = await loadSupabaseUser(sessRes.data.session.user);
      if(!cu) return;
      CU = window.CU = cu;
      updateNavUI(cu);
      try{ localStorage.setItem('ps_session', JSON.stringify({email:cu.email, sb:true})); }catch(e){}
      console.log('[PS Auth] Sesión restaurada:', cu.name);
      if(typeof updNotifBell === 'function') updNotifBell();
    }catch(e){
      console.error('[PS Auth] Session restore error:', e);
    }
  }

  // ─── SANITIZE: eliminar contraseñas legacy de localStorage ──

  function sanitizeLegacyState(){
    try{
      if(typeof ST === 'undefined') return;
      var dirty = false;
      (ST.users || []).forEach(function(u){
        if(u.pw !== undefined){ delete u.pw; dirty = true; }
        if(u.password !== undefined){ delete u.password; dirty = true; }
      });
      (ST.pending || []).forEach(function(p){
        if(p.pw !== undefined){ delete p.pw; dirty = true; }
        if(p.password !== undefined){ delete p.password; dirty = true; }
      });
      if(dirty && typeof saveST === 'function'){
        saveST();
        console.log('[PS Auth] Contraseñas legacy eliminadas de localStorage');
      }
    }catch(e){}
  }

  // ─── EXPOSE BRIDGE ──────────────────────────────────────────

  window.PS_BRIDGE = {
    supabase: function(){ return sb; },
    isOnline: function(){ return SB_READY; },
    isDebug: function(){ return DEBUG_MODE; },
    authUser: function(){ return window.CU && window.CU._sb_uid ? window.CU : null; }
  };

  // ─── BOOT ───────────────────────────────────────────────────

  function boot(){
    initSupabase();
    if(typeof loadST === 'function'){ loadST(); sanitizeLegacyState(); }
    restoreSession();
    if(SB_READY && sb){
      sb.auth.onAuthStateChange(function(event){
        if(event === 'SIGNED_OUT' && window.CU && window.CU._sb_uid){
          CU = window.CU = null;
          updateNavUI(null);
        }
      });
    }
    console.log('[PS Auth] Bridge v4 — ' + (SB_READY ? 'producción' : 'SIN SUPABASE') + (DEBUG_MODE ? ' (debug)' : ''));
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
