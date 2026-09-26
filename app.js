(function(){
  "use strict";

  /* ---------------------------------------------------------------
     Language: dictionary-driven i18n with automatic country/browser
     detection, plus a manual override the person can set from the
     hamburger menu or the dedicated language.html page.
  --------------------------------------------------------------- */
  var LANG_KEY = 'uz_lang';
  var LANG_MANUAL_KEY = 'uz_lang_manual';
  var SUPPORTED = ['en', 'zh-Hant', 'zh-Hans', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'th', 'vi', 'id', 'ms', 'tr', 'nl', 'pl'];
  var SIMPLE_CODES = ['en','ja','ko','es','fr','de','pt','it','ru','ar','hi','th','vi','id','ms','tr','nl','pl'];
  var DICT = window.TRANSLATIONS || {};

  function mapBrowserTag(tag){
    tag = (tag || '').toLowerCase();
    if(tag.indexOf('zh') === 0){
      if(tag.indexOf('hant') !== -1 || tag.indexOf('tw') !== -1 || tag.indexOf('hk') !== -1 || tag.indexOf('mo') !== -1) return 'zh-Hant';
      return 'zh-Hans';
    }
    for(var i=0; i<SIMPLE_CODES.length; i++){
      if(tag.indexOf(SIMPLE_CODES[i]) === 0) return SIMPLE_CODES[i];
    }
    return null;
  }

  function detectLang(){
    var tags = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for(var i=0; i<tags.length; i++){
      var m = mapBrowserTag(tags[i]);
      if(m) return m;
    }
    return 'en';
  }

  var currentLang = 'en';
  var currentMemberId = null;
  var currentDetected = detectLang();

  function applyLang(lang, manual){
    if(SUPPORTED.indexOf(lang) === -1) lang = 'en';
    currentLang = lang;
    var d = DICT[lang] || DICT.en;

    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      var val = (d && d[key] !== undefined) ? d[key] : (DICT.en && DICT.en[key]);
      if(val !== undefined) el.innerHTML = val;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
      var key = el.getAttribute('data-i18n-placeholder');
      var val = (d && d[key] !== undefined) ? d[key] : (DICT.en && DICT.en[key]);
      if(val !== undefined) el.setAttribute('placeholder', val);
    });

    document.querySelectorAll('[data-lang-name]').forEach(function(el){
      el.textContent = d._label;
    });

    document.querySelectorAll('.lang-btn, .lang-option').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-setlang') === lang);
    });

    if(manual){
      try{
        localStorage.setItem(LANG_KEY, lang);
        localStorage.setItem(LANG_MANUAL_KEY, '1');
      }catch(e){}
    }

    if(currentMemberId) renderMember(currentMemberId);
    renderAuthNav();
    document.dispatchEvent(new CustomEvent('uzlangchange', { detail: { lang: lang } }));
  }
  window.UZ_setLanguage = function(lang){ applyLang(lang, true); };
  window.UZ_resetLanguage = function(){
    try{
      localStorage.removeItem(LANG_KEY);
      localStorage.removeItem(LANG_MANUAL_KEY);
    }catch(e){}
    applyLang(detectLang(), false);
  };
  window.UZ_getState = function(){
    return { current: currentLang, detected: currentDetected, manual: (function(){ try{ return localStorage.getItem(LANG_MANUAL_KEY) === '1'; }catch(e){ return false; } })() };
  };

  (function initLang(){
    var manual = false;
    var stored = null;
    try{
      manual = localStorage.getItem(LANG_MANUAL_KEY) === '1';
      stored = localStorage.getItem(LANG_KEY);
    }catch(e){}
    var initial = (manual && stored && SUPPORTED.indexOf(stored) !== -1) ? stored : currentDetected;
    applyLang(initial, false);
  })();

  document.querySelectorAll('.lang-btn, .lang-option').forEach(function(b){
    b.addEventListener('click', function(){ applyLang(b.getAttribute('data-setlang'), true); });
  });

  var topbar = document.getElementById('topbar');
  var hero = document.getElementById('hero');
  var menuBtn = document.getElementById('menuBtn');
  var fullmenu = document.getElementById('fullmenu');

  /* topbar solid state after leaving hero */
  var heroObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting && e.intersectionRatio > 0.6){
        topbar.classList.remove('solid');
      } else {
        topbar.classList.add('solid');
      }
    });
  }, { threshold: [0, 0.6, 1] });
  if(hero){ heroObserver.observe(hero); }

  /* fullscreen hamburger menu */
  function openMenu(){
    fullmenu.classList.add('open');
    fullmenu.setAttribute('aria-hidden','false');
    menuBtn.classList.add('open');
    menuBtn.setAttribute('aria-expanded','true');
    document.body.style.overflow='hidden';
  }
  function closeMenu(){
    fullmenu.classList.remove('open');
    fullmenu.setAttribute('aria-hidden','true');
    menuBtn.classList.remove('open');
    menuBtn.setAttribute('aria-expanded','false');
    document.body.style.overflow='';
  }
  menuBtn.addEventListener('click', function(){
    fullmenu.classList.contains('open') ? closeMenu() : openMenu();
  });
  fullmenu.querySelectorAll('[data-close]').forEach(function(a){
    a.addEventListener('click', closeMenu);
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeMenu();
  });

  /* ---------------------------------------------------------------
     Scroll-driven motion (Apple-style scrubbing, not fixed-duration
     autoplay): a single rAF loop reads scroll position and writes
     transforms/opacity directly, so motion tracks the scrollbar.
  --------------------------------------------------------------- */
  var heroBolt = document.querySelector('.hero-bolt');
  var heroTextEls = hero ? hero.querySelectorAll('.hero-kicker, .hero-title, .hero-sub') : [];

  var reelSection = document.getElementById('reel');
  var f1 = document.querySelector('.reel-frame.f1');
  var f2 = document.querySelector('.reel-frame.f2');
  var f3 = document.querySelector('.reel-frame.f3');
  var spark = document.getElementById('reelSpark');
  var reelCaption = document.querySelector('.reel-caption');

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function smooth(t){ return t*t*(3-2*t); }
  function range(p, a, b){ return clamp01((p - a) / (b - a)); }
  function mix(a, b, t){ return a + (b - a) * t; }

  var ticking = false;
  function updateMotion(){
    ticking = false;
    var vh = window.innerHeight;

    if(hero){
      var hp = clamp01(window.scrollY / (hero.offsetHeight * 0.9));
      if(heroBolt){
        heroBolt.style.transform = 'translateY(' + (hp*-40) + 'px) scale(' + (1 - hp*0.12) + ')';
        heroBolt.style.opacity = String(1 - hp*1.1);
      }
      heroTextEls.forEach(function(el){
        el.style.transform = 'translateY(' + (hp*-24) + 'px)';
        el.style.opacity = String(1 - hp*1.3);
      });
    }

    if(reelSection && f1 && f2 && f3){
      var rect = reelSection.getBoundingClientRect();
      var total = reelSection.offsetHeight - vh;
      var scrolled = -rect.top;
      var p = total > 0 ? clamp01(scrolled/total) : 0;

      var p1 = smooth(range(p, 0, 0.30));
      var out1 = smooth(range(p, 0.24, 0.36));
      f1.style.opacity = String(mix(0,1,p1) * (1-out1));
      f1.style.transform = 'scale(' + mix(0.9,1,p1) + ') translateX(' + mix(0,-120,out1) + 'px) rotate(' + mix(0,-8,out1) + 'deg)';

      var p2in = smooth(range(p, 0.30, 0.42));
      var p2out = smooth(range(p, 0.56, 0.68));
      var f2op = mix(0,1,p2in) * (1-p2out);
      f2.style.opacity = String(f2op);
      f2.style.transform = 'scale(' + mix(0.9,1,p2in) + ') translateX(' + mix(0,120,p2out) + 'px) rotate(' + mix(0,8,p2out) + 'deg)';

      var p3in = smooth(range(p, 0.62, 0.76));
      f3.style.opacity = String(mix(0,1,p3in));
      f3.style.transform = 'scale(' + mix(0.9,1.04,p3in) + ')';

      if(spark){
        var sIn = smooth(range(p, 0.58, 0.70));
        var sOut = smooth(range(p, 0.70, 0.92));
        var sScale = mix(0, 22, sIn) + mix(0, 14, sOut);
        spark.style.opacity = String(mix(0,1,sIn) * (1-sOut*0.95));
        spark.style.transform = 'translate(-50%,-50%) scale(' + sScale + ')';
      }
      if(reelCaption){
        var capIn = smooth(range(p, 0.74, 0.94));
        reelCaption.style.opacity = String(capIn);
        reelCaption.style.transform = 'translateY(' + mix(16,0,capIn) + 'px)';
      }
    }

    document.querySelectorAll('.parallax-visual').forEach(function(el){
      var r = el.getBoundingClientRect();
      var center = r.top + r.height/2 - vh/2;
      var t = clamp01(1 - Math.abs(center)/(vh*0.8));
      var shift = (center/vh) * 26;
      el.style.transform = 'translateY(' + shift + 'px)';
    });
  }
  function onScroll(){
    if(!ticking){
      ticking = true;
      window.requestAnimationFrame(updateMotion);
    }
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll);
  updateMotion();

  /* product sections reveal */
  var products = document.querySelectorAll('.product');
  var productObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('in-view');
        productObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.28 });
  products.forEach(function(p){ productObserver.observe(p); });

  /* generic drag-to-scroll tracks + dot indicators (used by homepage
     colour showcase and product gallery sliders) */
  document.querySelectorAll('.drag-track').forEach(function(track){
    var cards = track.children;
    var dotsWrap = track.nextElementSibling;
    if(!dotsWrap || !dotsWrap.classList.contains('drag-dots')) dotsWrap = null;

    if(dotsWrap){
      Array.prototype.forEach.call(cards, function(_, i){
        var d = document.createElement('span');
        if(i === 0) d.classList.add('active');
        dotsWrap.appendChild(d);
      });
      var dots = dotsWrap.querySelectorAll('span');

      var updateDots = function(){
        var center = track.scrollLeft + track.clientWidth/2;
        var closest = 0, minDist = Infinity;
        Array.prototype.forEach.call(cards, function(c, i){
          var cCenter = c.offsetLeft + c.offsetWidth/2;
          var dist = Math.abs(cCenter - center);
          if(dist < minDist){ minDist = dist; closest = i; }
        });
        dots.forEach(function(d,i){ d.classList.toggle('active', i === closest); });
      };
      track.addEventListener('scroll', function(){
        window.requestAnimationFrame(updateDots);
      }, { passive: true });
      updateDots();

      dots.forEach(function(d, i){
        d.addEventListener('click', function(){
          cards[i].scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
        });
      });
    }

    var isDown = false, startX, scrollStart;
    track.addEventListener('mousedown', function(e){
      isDown = true;
      track.classList.add('dragging');
      startX = e.pageX;
      scrollStart = track.scrollLeft;
    });
    window.addEventListener('mouseup', function(){
      isDown = false;
      track.classList.remove('dragging');
    });
    window.addEventListener('mousemove', function(e){
      if(!isDown) return;
      e.preventDefault();
      var walk = (e.pageX - startX);
      track.scrollLeft = scrollStart - walk;
    });
  });

  /* photo fallback: show placeholder until a real image loads,
     keep placeholder if the file is missing */
  document.querySelectorAll('.photo img').forEach(function(img){
    var wrap = img.closest('.photo');
    if(!img.getAttribute('src')) return;
    function markLoaded(){ wrap.classList.add('loaded'); }
    if(img.complete && img.naturalWidth > 0){
      markLoaded();
    } else {
      img.addEventListener('load', markLoaded);
      img.addEventListener('error', function(){ wrap.classList.remove('loaded'); });
    }
  });

  /* employee modal: click an avatar to open their full introduction.
     Content comes straight from the same TRANSLATIONS dictionary
     used for the rest of the site, keyed by a short prefix per person. */
  var MEMBERS = {
    ceo:  { photo: 'assets/team/ceo.jpg',      prefix: 'ceo'  },
    vice: { photo: 'assets/team/vice_ceo.jpg', prefix: 'vice' }
  };
  var modal = document.getElementById('memberModal');
  var modalPhoto, modalWrap, modalName, modalRole, modalBio, modalFact;

  function renderMember(id){
    var m = MEMBERS[id];
    if(!m) return;
    var d = DICT[currentLang] || DICT.en;
    modalPhoto.src = m.photo;
    modalPhoto.alt = d[m.prefix + '_name'] || '';
    modalWrap.classList.remove('loaded');
    modalName.textContent = d[m.prefix + '_name'];
    modalRole.textContent = d[m.prefix + '_role'];
    modalBio.innerHTML = '<p>' + d[m.prefix + '_bio1'] + '</p><p>' + d[m.prefix + '_bio2'] + '</p>';
    var fact = d[m.prefix + '_fact'];
    if(fact){
      modalFact.innerHTML = '<b>' + d.modal_fact_label + '　</b>' + fact;
      modalFact.style.display = 'block';
    } else {
      modalFact.style.display = 'none';
    }
    if(modalPhoto.complete && modalPhoto.naturalWidth > 0){ modalWrap.classList.add('loaded'); }
  }

  if(modal && Object.keys(MEMBERS).length){
    modalPhoto = modal.querySelector('.member-modal-photo img');
    modalWrap = modal.querySelector('.member-modal-photo .photo');
    modalName = modal.querySelector('.member-modal-body h3');
    modalRole = modal.querySelector('.member-modal-role');
    modalBio = modal.querySelector('.member-modal-bio');
    modalFact = modal.querySelector('.member-modal-fact');

    function openMember(id){
      currentMemberId = id;
      renderMember(id);
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeMember(){
      modal.classList.remove('open');
      document.body.style.overflow = '';
      currentMemberId = null;
    }
    document.querySelectorAll('.team-card[data-member]').forEach(function(card){
      card.addEventListener('click', function(){ openMember(card.getAttribute('data-member')); });
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openMember(card.getAttribute('data-member')); }
      });
    });
    modal.querySelector('.member-modal-backdrop').addEventListener('click', closeMember);
    modal.querySelector('.member-modal-close').addEventListener('click', closeMember);
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') closeMember();
    });
  }

  /* product sub-page breadcrumb bar reveal */
  var crumb = document.getElementById('pCrumb');
  if(crumb){
    window.addEventListener('scroll', function(){
      crumb.classList.toggle('show', window.scrollY > 420);
    }, { passive:true });
  }

  /* language.html: render the language picker + detected-language note */
  var langPicker = document.getElementById('langPicker');
  if(langPicker){
    SUPPORTED.forEach(function(code){
      var d = DICT[code];
      var btn = document.createElement('button');
      btn.className = 'lang-option';
      btn.setAttribute('data-setlang', code);
      btn.innerHTML =
        '<span class="lang-option-native">' + d._native + '</span>' +
        '<span class="lang-option-meta">' + d._label + ' · ' + d._region + '</span>';
      btn.addEventListener('click', function(){ applyLang(code, true); updateDetectedNote(); });
      langPicker.appendChild(btn);
    });
    applyLang(currentLang, false); // paint active state on freshly-built buttons
  }
  var detectedNote = document.getElementById('langDetectedNote');
  function updateDetectedNote(){
    if(!detectedNote) return;
    var state = window.UZ_getState();
    var d = DICT[state.current] || DICT.en;
    var prefixKey = state.manual ? 'lang_manual_prefix' : 'lang_detected_prefix';
    detectedNote.innerHTML = '<span data-i18n="' + prefixKey + '">' + d[prefixKey] + '</span> ' + d._native;
  }
  if(detectedNote){
    updateDetectedNote();
    document.addEventListener('uzlangchange', updateDetectedNote);
  }
  var resetBtn = document.getElementById('langResetBtn');
  if(resetBtn){
    resetBtn.addEventListener('click', function(){
      window.UZ_resetLanguage();
      updateDetectedNote();
    });
  }

  /* ---------------------------------------------------------------
     Auth: email + one-time-code sign-in, backed by a real Cloudflare
     Pages Functions API (see functions/api/*.js) and a D1 database.
     The session lives in an httpOnly cookie set by the server — this
     file only calls the API and reflects whatever it says back.
     Until that API is deployed (see DEPLOY.md), these calls will
     fail with a network error, which is expected, not a bug.
  --------------------------------------------------------------- */
  var API = {
    sendCode: function(email){
      return apiCall('/api/send-code', { email: email });
    },
    verifyCode: function(email, code){
      return apiCall('/api/verify-code', { email: email, code: code });
    },
    setProfile: function(displayName, password){
      return apiCall('/api/set-profile', { displayName: displayName, password: password });
    },
    signOut: function(){
      return apiCall('/api/sign-out', {});
    },
    session: function(){
      return fetch('/api/session', { credentials: 'include' }).then(function(res){
        if(!res.ok) return null;
        return res.json();
      }).catch(function(){ return null; });
    }
  };
  function apiCall(url, body){
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if(!res.ok || data.ok === false) throw new Error(data.error || ('Request failed (' + res.status + ')'));
        return data;
      });
    });
  }

  var cachedSession = undefined; // undefined = not fetched yet, null = signed out
  function refreshSession(){
    return API.session().then(function(data){
      cachedSession = (data && data.ok) ? { email: data.email, name: data.displayName, avatarUrl: data.avatarUrl } : null;
      renderAuthNav();
      return cachedSession;
    });
  }
  window.UZ_getSession = function(){ return cachedSession || null; };
  window.UZ_signOut = function(){
    return API.signOut().catch(function(){}).then(function(){
      cachedSession = null;
      renderAuthNav();
    });
  };

  // deterministic color from a string, for the initials-avatar fallback
  var AVATAR_COLORS = ['#3aa0ff','#6f7078','#8b7bf0','#e0a63c','#4bb37a','#e0453c'];
  function colorFor(str){
    var h = 0;
    for(var i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) | 0; }
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }
  function initialFor(name, email){
    var source = (name || email || '?').trim();
    return source.charAt(0).toUpperCase();
  }
  function paintAvatar(el, session){
    if(session.avatarUrl){
      el.style.backgroundImage = 'url(' + session.avatarUrl + ')';
      el.style.backgroundColor = '';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.style.backgroundColor = colorFor(session.email);
      el.textContent = initialFor(session.name, session.email);
    }
  }

  function renderAuthNav(){
    var d = DICT[currentLang] || DICT.en;
    document.querySelectorAll('.nav-auth-slot').forEach(function(el){
      var avatarEl = el.querySelector('.nav-avatar');
      var nameEl = el.querySelector('.nav-auth-name');
      if(cachedSession){
        el.classList.add('signed-in');
        el.title = d.auth_sign_out;
        if(nameEl) nameEl.textContent = cachedSession.name ? cachedSession.name : cachedSession.email;
        if(avatarEl) paintAvatar(avatarEl, cachedSession);
      } else {
        el.classList.remove('signed-in');
        el.removeAttribute('title');
        if(nameEl) nameEl.textContent = d.nav_signin;
      }
    });
  }
  renderAuthNav();
  refreshSession();

  /* login.html only, guarded so it's a no-op on every other page */
  var stepEmail = document.getElementById('authStepEmail');
  var stepCode = document.getElementById('authStepCode');
  var stepProfile = document.getElementById('authStepProfile');
  var stepSuccess = document.getElementById('authStepSuccess');
  if(stepEmail && stepCode && stepSuccess){
    var emailInput = document.getElementById('authEmailInput');
    var codeInput = document.getElementById('authCodeInput');
    var nameInput = document.getElementById('authNameInput');
    var passwordInput = document.getElementById('authPasswordInput');
    var passwordConfirmInput = document.getElementById('authPasswordConfirmInput');
    var sendBtn = document.getElementById('authSendBtn');
    var verifyBtn = document.getElementById('authVerifyBtn');
    var saveProfileBtn = document.getElementById('authSaveProfileBtn');
    var resendBtn = document.getElementById('authResendBtn');
    var changeEmailBtn = document.getElementById('authChangeEmailBtn');
    var signOutBtn = document.getElementById('authSignOutBtn');
    var errorEl = document.getElementById('authError');
    var errorEl2 = document.getElementById('authError2');
    var errorEl3 = document.getElementById('authError3');
    var codeSubEl = document.getElementById('authCodeSub');
    var welcomeTitleEl = document.getElementById('authWelcomeTitle');
    var welcomeAvatarEl = document.getElementById('authWelcomeAvatar');
    var discordBtn = document.getElementById('authDiscordBtn');
    var pendingEmail = null;

    function showStep(step){
      [stepEmail, stepCode, stepProfile, stepSuccess].forEach(function(s){ if(s) s.classList.remove('active'); });
      step.classList.add('active');
      if(errorEl) errorEl.textContent = '';
      if(errorEl2) errorEl2.textContent = '';
      if(errorEl3) errorEl3.textContent = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function fillTemplate(str, map){
      return Object.keys(map).reduce(function(s, k){ return s.replace('{'+k+'}', map[k]); }, str);
    }
    function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function setBusy(btn, busy){ if(btn) btn.disabled = busy; }

    function enterSuccess(email, name, avatarUrl){
      var d = DICT[currentLang] || DICT.en;
      cachedSession = { email: email, name: name, avatarUrl: avatarUrl || '' };
      renderAuthNav();
      welcomeTitleEl.textContent = fillTemplate(d.auth_welcome_title, { name: name || email });
      paintAvatar(welcomeAvatarEl, cachedSession);
      showStep(stepSuccess);
    }

    function sendCode(){
      var email = (emailInput.value || '').trim();
      var d = DICT[currentLang] || DICT.en;
      if(!validEmail(email)){
        errorEl.textContent = d.auth_error_email;
        return;
      }
      errorEl.textContent = '';
      setBusy(sendBtn, true); setBusy(resendBtn, true);
      API.sendCode(email).then(function(){
        pendingEmail = email;
        codeSubEl.innerHTML = fillTemplate(d.auth_sub_code, { email: email });
        codeInput.value = '';
        showStep(stepCode);
      }).catch(function(err){
        errorEl.textContent = err.message;
      }).finally(function(){
        setBusy(sendBtn, false); setBusy(resendBtn, false);
      });
    }

    function verifyCode(){
      var d = DICT[currentLang] || DICT.en;
      var entered = (codeInput.value || '').trim();
      if(!entered){ errorEl2.textContent = d.auth_error_code; return; }
      setBusy(verifyBtn, true);
      API.verifyCode(pendingEmail, entered).then(function(data){
        if(data.isNewUser && stepProfile){
          nameInput.value = ''; passwordInput.value = ''; passwordConfirmInput.value = '';
          showStep(stepProfile);
        } else {
          enterSuccess(data.email, data.displayName, data.avatarUrl);
        }
      }).catch(function(err){
        errorEl2.textContent = err.message;
      }).finally(function(){
        setBusy(verifyBtn, false);
      });
    }

    function saveProfileAndContinue(){
      var d = DICT[currentLang] || DICT.en;
      var name = (nameInput.value || '').trim();
      var pw = passwordInput.value || '';
      var pw2 = passwordConfirmInput.value || '';
      if(!name){ errorEl3.textContent = d.auth_error_name; return; }
      if(pw.length < 6){ errorEl3.textContent = d.auth_error_password_length; return; }
      if(pw !== pw2){ errorEl3.textContent = d.auth_error_password_match; return; }
      errorEl3.textContent = '';
      setBusy(saveProfileBtn, true);
      API.setProfile(name, pw).then(function(data){
        enterSuccess(data.email, data.displayName, data.avatarUrl);
      }).catch(function(err){
        errorEl3.textContent = err.message;
      }).finally(function(){
        setBusy(saveProfileBtn, false);
      });
    }

    sendBtn.addEventListener('click', sendCode);
    emailInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') sendCode(); });
    verifyBtn.addEventListener('click', verifyCode);
    codeInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') verifyCode(); });
    resendBtn.addEventListener('click', sendCode);
    changeEmailBtn.addEventListener('click', function(){ showStep(stepEmail); });
    if(saveProfileBtn){
      saveProfileBtn.addEventListener('click', saveProfileAndContinue);
      passwordConfirmInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') saveProfileAndContinue(); });
    }
    signOutBtn.addEventListener('click', function(){
      window.UZ_signOut().then(function(){
        emailInput.value = '';
        showStep(stepEmail);
      });
    });
    if(discordBtn){
      discordBtn.addEventListener('click', function(){
        window.location.href = '/api/auth/discord/start';
      });
    }

    refreshSession().then(function(session){
      if(session){
        enterSuccess(session.email, session.name, session.avatarUrl);
      } else {
        showStep(stepEmail);
      }
    });
  }

  /* ---------------------------------------------------------------
     Cart: a simple client-side cart (localStorage), shared across
     the shop teaser, store.html and cart.html via products.js.
     Viewing the cart requires being signed in — the icon redirects
     to login.html first if there's no session yet.
  --------------------------------------------------------------- */
  var CART_KEY = 'uz_cart';
  var PRODUCTS = window.UZ_PRODUCTS || [];

  function getCart(){
    try{ return JSON.parse(localStorage.getItem(CART_KEY) || '{}'); }catch(e){ return {}; }
  }
  function setCart(cart){
    try{ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }catch(e){}
    renderCartBadge();
  }
  function addToCart(id, qty){
    var cart = getCart();
    cart[id] = (cart[id] || 0) + qty;
    setCart(cart);
  }
  function setCartQty(id, qty){
    var cart = getCart();
    if(qty <= 0){ delete cart[id]; } else { cart[id] = qty; }
    setCart(cart);
  }
  function cartCount(){
    var cart = getCart();
    return Object.keys(cart).reduce(function(sum, id){ return sum + cart[id]; }, 0);
  }
  function productById(id){
    for(var i=0;i<PRODUCTS.length;i++){ if(PRODUCTS[i].id === id) return PRODUCTS[i]; }
    return null;
  }
  window.UZ_cart = {
    get: getCart, add: addToCart, setQty: setCartQty, count: cartCount, product: productById
  };

  function renderCartBadge(){
    var count = cartCount();
    document.querySelectorAll('.cart-badge').forEach(function(el){
      el.textContent = count > 99 ? '99+' : String(count);
      el.classList.toggle('show', count > 0);
    });
  }
  renderCartBadge();

  document.querySelectorAll('.cart-btn, .topbar-cart-inline').forEach(function(el){
    el.addEventListener('click', function(e){
      e.preventDefault();
      if(cachedSession){
        window.location.href = 'cart.html';
      } else {
        window.location.href = 'login.html';
      }
    });
  });

  /* store.html: quantity steppers + add-to-cart feedback */
  document.querySelectorAll('[data-product-card]').forEach(function(card){
    var id = card.getAttribute('data-product-card');
    var qtyEl = card.querySelector('.qty-value');
    var minusBtn = card.querySelector('.qty-minus');
    var plusBtn = card.querySelector('.qty-plus');
    var addBtn = card.querySelector('.add-cart-btn');
    var qty = 1;
    function paintQty(){ if(qtyEl) qtyEl.textContent = String(qty); }
    if(minusBtn) minusBtn.addEventListener('click', function(){ qty = Math.max(1, qty - 1); paintQty(); });
    if(plusBtn) plusBtn.addEventListener('click', function(){ qty = Math.min(99, qty + 1); paintQty(); });
    if(addBtn){
      addBtn.addEventListener('click', function(){
        addToCart(id, qty);
        var d = DICT[currentLang] || DICT.en;
        var original = addBtn.textContent;
        addBtn.textContent = d.shop_added;
        addBtn.classList.add('added');
        setTimeout(function(){
          addBtn.textContent = original;
          addBtn.classList.remove('added');
        }, 1400);
      });
    }
  });

  /* cart.html: render items, let quantities change, fake a checkout.
     Also gated on being signed in, in case someone lands here directly
     rather than through the cart icon. */
  var cartList = document.getElementById('cartList');
  if(cartList){
    refreshSession().then(function(session){
      if(!session){ window.location.href = 'login.html'; return; }
      initCartPage();
    });
  }
  function initCartPage(){
    var cartEmptyEl = document.getElementById('cartEmpty');
    var cartSummaryEl = document.getElementById('cartSummary');
    var cartSubtotalEl = document.getElementById('cartSubtotal');
    var checkoutBtn = document.getElementById('checkoutBtn');
    var cartViewEl = document.getElementById('cartView');
    var cartThanksEl = document.getElementById('cartThanks');

    function money(n){ return '$' + n.toFixed(2); }

    function renderCartList(){
      var d = DICT[currentLang] || DICT.en;
      var cart = getCart();
      var ids = Object.keys(cart);
      cartList.innerHTML = '';
      if(ids.length === 0){
        cartEmptyEl.style.display = 'block';
        cartSummaryEl.style.display = 'none';
        return;
      }
      cartEmptyEl.style.display = 'none';
      cartSummaryEl.style.display = 'block';
      var subtotal = 0;
      ids.forEach(function(id){
        var p = productById(id);
        if(!p) return;
        var qty = cart[id];
        subtotal += p.price * qty;
        var row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML =
          '<div class="cart-item-img"><img src="' + p.image + '" alt=""></div>' +
          '<div class="cart-item-info"><h4>' + d[p.nameKey] + '</h4><span>' + money(p.price) + '</span></div>' +
          '<div class="cart-item-qty">' +
            '<button class="qty-btn" data-act="minus">\u2013</button>' +
            '<span class="qty-value">' + qty + '</span>' +
            '<button class="qty-btn" data-act="plus">+</button>' +
          '</div>' +
          '<button class="cart-item-remove" data-act="remove">\u2715</button>';
        row.querySelector('[data-act="minus"]').addEventListener('click', function(){ setCartQty(id, cart[id]-1); renderCartList(); });
        row.querySelector('[data-act="plus"]').addEventListener('click', function(){ setCartQty(id, cart[id]+1); renderCartList(); });
        row.querySelector('[data-act="remove"]').addEventListener('click', function(){ setCartQty(id, 0); renderCartList(); });
        cartList.appendChild(row);
      });
      cartSubtotalEl.textContent = money(subtotal);
    }
    renderCartList();
    document.addEventListener('uzlangchange', renderCartList);

    if(checkoutBtn){
      checkoutBtn.addEventListener('click', function(){
        setCart({});
        renderCartList();
        cartViewEl.style.display = 'none';
        cartThanksEl.style.display = 'block';
      });
    }
  }

  /* login.html: admin username+password shortcut (bypasses the email
     code step entirely — see functions/api/admin-login.js) */
  var adminToggle = document.getElementById('adminToggle');
  var adminPanel = document.getElementById('adminPanel');
  if(adminToggle && adminPanel){
    adminToggle.addEventListener('click', function(){
      adminPanel.classList.toggle('open');
    });
    var adminBtn = document.getElementById('adminSignInBtn');
    var adminUserInput = document.getElementById('adminUsernameInput');
    var adminPassInput = document.getElementById('adminPasswordInput');
    var adminError = document.getElementById('adminError');
    if(adminBtn){
      adminBtn.addEventListener('click', function(){
        var d = DICT[currentLang] || DICT.en;
        adminError.textContent = '';
        adminBtn.disabled = true;
        apiCall('/api/admin-login', {
          username: adminUserInput.value || '',
          password: adminPassInput.value || ''
        }).then(function(data){
          cachedSession = { email: data.email, name: data.displayName, avatarUrl: '' };
          renderAuthNav();
          window.location.href = 'index.html';
        }).catch(function(err){
          adminError.textContent = err.message || d.admin_error;
        }).finally(function(){
          adminBtn.disabled = false;
        });
      });
    }
  }

})();
