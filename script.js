/* ============================================================
   PostHog init — safe by design. Unchanged from before.
   ============================================================ */
try {
  !function (t, e) {
    var o, n, p, r;
    e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) {
      function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }
      (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0,
        p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js",
        (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
      var u = e;
      for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [],
        u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e },
        u.people.toString = function () { return u.toString(1) + ".people (stub)" },
        o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify alias set_config startSessionRecording stopSessionRecording captureException loadToolbar get_distinct_id updateEarlyAccessFeatureEnrollment getGroups get_property getSessionProperty createPersonProfile want_session_recording_props opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),
        n = 0; n < o.length; n++) g(u, o[n]);
      e._i.push([i, s, a])
    }, e.__SV = 1)
  }(document, window.posthog || []);

  posthog.init('phc_vQWFVZTUAUPkGAeUD9tWSwfmkYWVmaWyohFnn64GQFqd', { api_host: 'https://us.i.posthog.com', capture_pageview: true, autocapture: false, disable_session_recording: false, capture_pageleave: true });
} catch (err) {
  window.posthog = window.posthog || { capture: function () {} };
}

/* ============================================================
   ATTRIBUTION — first-touch vs. last-touch, kept distinct.

   first_touch_* : captured once, the first time this visitor
   ever landed on the site, persisted in localStorage forever.
   Answers "how did this person originally find me."

   last_touch_* : read fresh from the URL on every single page
   load, never persisted. Answers "what link did they click to
   get to THIS page" — critical for one-off campaign links like
   /cv?utm_campaign=appsflyer that should be measurable on their
   own, independent of how the visitor first discovered the site.

   Both ride on every event. Never merged into one "utm_source."
   ============================================================ */
var ACQ_KEY = 'ez_acquisition_v1';

function readUTMFromURL() {
  var params = new URLSearchParams(window.location.search);
  var fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var out = {};
  var found = false;
  fields.forEach(function (f) {
    var v = params.get(f);
    if (v) { out[f] = v.trim().toLowerCase(); found = true; }
  });
  return found ? out : null;
}

var isReturningVisitor = false;
function getFirstTouch() {
  try {
    var fromUrl = readUTMFromURL();
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(ACQ_KEY)); } catch (e) { stored = null; }
    if (!stored) {
      isReturningVisitor = false;
      var acquisition = fromUrl || {};
      acquisition.referrer = document.referrer || '(direct)';
      acquisition.landing_page = window.location.pathname;
      acquisition.first_seen = new Date().toISOString();
      try { localStorage.setItem(ACQ_KEY, JSON.stringify(acquisition)); } catch (e) {}
      return acquisition;
    }
    isReturningVisitor = true;
    return stored;
  } catch (err) {
    return {};
  }
}

var firstTouch = getFirstTouch();
var lastTouch = readUTMFromURL() || {};
var lastTouchReferrer = document.referrer || '(direct)';

/* ============================================================
   HIRING INTENT SCORE — live, not just documented.
   Persists in localStorage across visits (a recruiter who comes
   back next week keeps their accumulated score) and is written
   to the PostHog Persons table as it changes, so you can sort
   Persons by hiring_intent_score directly instead of calculating
   it by hand from raw events. Weights per ANALYTICS.md.

   high_intent_reached fires once, the first time a visitor
   crosses the threshold — tag a PostHog alert/webhook on this
   single event instead of every CV click individually.
   ============================================================ */
var SCORE_KEY = 'ez_intent_score_v1';
var HIGH_INTENT_THRESHOLD = 35;
var intentScore = 0;
var highIntentFired = false;
(function () {
  try {
    var stored = parseInt(localStorage.getItem(SCORE_KEY), 10);
    if (!isNaN(stored)) intentScore = stored;
  } catch (e) {}
})();

var INTENT_WEIGHTS = {
  landing_page_view: 1,
  case_study_opened: 3,
  case_study_engaged_15s: 4,
  cv_opened: 5,
  cv_30s: 3,
  cv_60s: 3,
  cv_downloaded: 10,
  contact_viewed: 3,
  contact_form_started: 6,
  contact_form_submitted: 15,
  linkedin_clicked: 2,
  follow_up_requested: 15
};

function addIntentScore(eventName) {
  var points = INTENT_WEIGHTS[eventName];
  if (!points) return;
  intentScore += points;
  try { localStorage.setItem(SCORE_KEY, String(intentScore)); } catch (e) {}
  try {
    if (window.posthog && typeof posthog.setPersonProperties === 'function') {
      posthog.setPersonProperties({ hiring_intent_score: intentScore });
    } else if (window.posthog && posthog.people && typeof posthog.people.set === 'function') {
      posthog.people.set({ hiring_intent_score: intentScore });
    }
  } catch (e) {}
  if (!highIntentFired && intentScore >= HIGH_INTENT_THRESHOLD) {
    highIntentFired = true;
    /* Persisted so a returning high-score visitor doesn't re-fire the
       event (and re-ping Slack) on every page load. */
    if (!storedFlag('ez_high_intent_fired_v1')) {
      setFlag('ez_high_intent_fired_v1', '1');
      track('high_intent_reached', { score: intentScore });
    }
  }
  maybeShowFollowUpPrompt();
}

/* ============================================================
   HIGH-INTENT FOLLOW-UP PROMPT — a small, dismissible slide-in
   (not a modal) offered once to a visitor whose score crossed
   the threshold. Voluntary email only: it is an offer, never a
   gate. Shown at most once per browser (dismissed, submitted,
   or already identified via the contact form = never again).
   Delivery: Formspree when an endpoint is known (read from the
   contact form on the homepage and remembered for other pages),
   otherwise PostHog only. Submitting identifies the visitor in
   PostHog, linking their prior browsing to the email they chose
   to give.
   ============================================================ */
var PROMPT_KEY = 'ez_followup_prompt_v1';
var IDENTIFIED_KEY = 'ez_identified_v1';
var ENDPOINT_KEY = 'ez_form_endpoint_v1';
var promptScheduled = false;

function storedFlag(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function setFlag(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

function followUpEndpoint() {
  var f = document.getElementById('contact-form');
  if (f && f.action && f.action.indexOf('INSERT') === -1) { setFlag(ENDPOINT_KEY, f.action); return f.action; }
  var saved = storedFlag(ENDPOINT_KEY);
  return (saved && saved.indexOf('INSERT') === -1) ? saved : null;
}

function maybeShowFollowUpPrompt() {
  if (promptScheduled) return;
  if (intentScore < HIGH_INTENT_THRESHOLD) return;
  if (storedFlag(PROMPT_KEY) || storedFlag(IDENTIFIED_KEY)) return;
  promptScheduled = true;
  var go = function () {
    if (document.body && document.body.hasAttribute('data-no-prompt')) return;
    setTimeout(showFollowUpPrompt, 4000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}

function showFollowUpPrompt() {
  if (document.getElementById('followup') || storedFlag(PROMPT_KEY)) return;
  var box = document.createElement('aside');
  box.id = 'followup';
  box.className = 'followup';
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Request a follow-up');
  box.innerHTML =
    '<button type="button" class="followup-close" aria-label="Dismiss">&times;</button>' +
    '<p class="followup-title">Want me to follow up?</p>' +
    '<p class="followup-body">Leave your email and I\u2019ll reach out personally. No newsletters, no list.</p>' +
    '<form class="followup-form" novalidate>' +
      '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" class="followup-hp">' +
      '<input type="email" name="email" aria-label="Email address" placeholder="you@company.com" required autocomplete="email">' +
      '<button type="submit" class="btn btn-primary">Send</button>' +
    '</form>' +
    '<p class="followup-status" role="status" aria-live="polite"></p>';
  document.body.appendChild(box);
  requestAnimationFrame(function () { box.classList.add('is-visible'); });
  track('follow_up_prompt_shown', { score: intentScore });

  function close(reason) {
    setFlag(PROMPT_KEY, reason);
    box.classList.remove('is-visible');
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 400);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') { track('follow_up_prompt_dismissed', { via: 'escape' }); close('dismissed'); } }
  document.addEventListener('keydown', onKey);

  box.querySelector('.followup-close').addEventListener('click', function () {
    track('follow_up_prompt_dismissed', { via: 'close_button' });
    close('dismissed');
  });

  var form = box.querySelector('form');
  var status = box.querySelector('.followup-status');
  var sending = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var emailInput = form.querySelector('input[type="email"]');
    if (!emailInput.value || !emailInput.checkValidity()) { status.textContent = 'Please enter a valid email.'; return; }
    sending = true;
    form.querySelector('button').disabled = true;
    status.textContent = 'Sending\u2026';
    var email = emailInput.value.trim();
    var endpoint = followUpEndpoint();

    function done(delivery) {
      status.textContent = 'Thanks \u2014 I\u2019ll be in touch.';
      setFlag(IDENTIFIED_KEY, '1');
      try { if (window.posthog && typeof posthog.identify === 'function') posthog.identify(email, { email: email }); } catch (err) {}
      track('follow_up_requested', { score: intentScore, delivery: delivery });
      setTimeout(function () { close('submitted'); }, 3500);
    }
    function fail() {
      sending = false;
      form.querySelector('button').disabled = false;
      status.innerHTML = 'Couldn\u2019t send that. Email me at <a href="mailto:EthanZanger@gmail.com">EthanZanger@gmail.com</a>.';
    }

    if (!endpoint) { done('posthog_only'); return; }
    var data = new FormData(form);
    data.append('source', 'high_intent_prompt');
    data.append('intent_score', String(intentScore));
    data.append('traffic_source', firstTouch.utm_source || '');
    data.append('first_touch_utm_campaign', firstTouch.utm_campaign || '');
    fetch(endpoint, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } })
      .then(function (res) { if (res.ok) done('formspree'); else fail(); })
      .catch(fail);
  });
}
/* Returning visitor gets its one-time bonus immediately, since
   it's known at page load rather than from a later event. */
INTENT_WEIGHTS.__return_visit__ = 6;
if (isReturningVisitor) addIntentScore('__return_visit__');

/* Optional experiment tag — pass ?variant=b on any link. Persisted
   as a super-property for the session so every event downstream
   carries it, without building a full A/B testing system. */
(function () {
  try {
    var v = new URLSearchParams(window.location.search).get('variant');
    if (v && window.posthog && typeof posthog.register === 'function') {
      posthog.register({ experiment_variant: v });
    }
  } catch (e) {}
})();

/* ============================================================
   Safe event tracking helper. Every event carries both
   attribution sets plus the current path.
   ============================================================ */
function track(name, props) {
  addIntentScore(name);
  try {
    if (window.posthog && typeof posthog.capture === 'function') {
      posthog.capture(name, Object.assign(
        {
          first_touch_utm_source: firstTouch.utm_source,
          first_touch_utm_medium: firstTouch.utm_medium,
          first_touch_utm_campaign: firstTouch.utm_campaign,
          first_touch_utm_content: firstTouch.utm_content,
          first_touch_utm_term: firstTouch.utm_term,
          traffic_source: firstTouch.utm_source || (function () {
            try { var r = firstTouch.referrer; if (!r || r === '(direct)') return 'direct'; return new URL(r).hostname.replace(/^www\./, ''); } catch (e) { return 'direct'; }
          })(),
          first_touch_referrer: firstTouch.referrer,
          first_touch_landing_page: firstTouch.landing_page,
          last_touch_utm_source: lastTouch.utm_source,
          last_touch_utm_medium: lastTouch.utm_medium,
          last_touch_utm_campaign: lastTouch.utm_campaign,
          last_touch_utm_content: lastTouch.utm_content,
          last_touch_utm_term: lastTouch.utm_term,
          last_touch_referrer: lastTouchReferrer,
          page_path: window.location.pathname,
          is_returning_visitor: isReturningVisitor
        },
        props || {}
      ));
    }
  } catch (err) {
    /* analytics must never break the page */
  }
}

/* ============================================================
   ENGAGED SESSION — a single, documented definition, fired once.
   Qualifies on ANY of: 30s of visible/focused time on page,
   a case study reaching 50%, viewing the CV, downloading the
   CV, or clicking Contact/LinkedIn/Calendly. Idle background
   tabs don't count toward the 30s timer.
   ============================================================ */
var engagedSessionFired = false;
function markEngagedSession(reason) {
  if (engagedSessionFired) return;
  engagedSessionFired = true;
  try {
    if (window.posthog && typeof posthog.register === 'function') {
      posthog.register({ engaged_session: true });
    }
  } catch (e) {}
  track('engaged_session', { reason: reason });
}
(function () {
  var visibleMs = 0;
  var last = Date.now();
  var tick = setInterval(function () {
    var now = Date.now();
    if (document.visibilityState === 'visible') {
      visibleMs += now - last;
    }
    last = now;
    if (visibleMs >= 30000) {
      markEngagedSession('30s_active');
      clearInterval(tick);
    }
  }, 2000);
})();

/* One landing_page_view per page load — distinct from PostHog's
   automatic $pageview, this is the acquisition-model event the
   funnel is built on. */
track('landing_page_view', {
  browser_language: navigator.language || undefined,
  timezone: (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return undefined; }
  })()
});

document.addEventListener('DOMContentLoaded', function () {
  followUpEndpoint();

  /* ----------------------------------------------------------
     Mobile nav toggle — unchanged behavior.
     ---------------------------------------------------------- */
  var toggle = document.querySelector('.nav-toggle');
  var list = document.getElementById('nav-list');
  if (toggle && list) {
    toggle.addEventListener('click', function () {
      var open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    list.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        list.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && list.classList.contains('open')) {
        list.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ----------------------------------------------------------
     cta_clicked — the exposure→click→conversion layer.
     Fires on any element tagged data-cta-type, alongside
     (never instead of) the specific outcome event it leads to
     (cv_downloaded, contact_form_submitted, etc). This is what
     lets a funnel distinguish "CTA was clicked" from "the thing
     the CTA promised actually happened."
     ---------------------------------------------------------- */
  function trackCTA(el) {
    track('cta_clicked', {
      cta_type: el.getAttribute('data-cta-type'),
      cta_location: el.getAttribute('data-nav-source') || el.getAttribute('data-cta-location') || 'unspecified',
      cta_text: (el.textContent || '').trim(),
      page: window.location.pathname
    });
  }

  /* ----------------------------------------------------------
     nav_click — any link carrying data-nav-destination.
     Also fires cta_clicked if the same element is tagged
     data-cta-type (most CV/contact links are both).
     ---------------------------------------------------------- */
  document.querySelectorAll('[data-nav-destination]').forEach(function (el) {
    el.addEventListener('click', function () {
      track('nav_click', { destination: el.getAttribute('data-nav-destination'), source: el.getAttribute('data-nav-source') || 'unspecified' });
      if (el.hasAttribute('data-cta-type')) trackCTA(el);
    });
  });

  /* ----------------------------------------------------------
     Contact CTAs.
     ---------------------------------------------------------- */
  var contactBindings = [
    ['#cta-linkedin', 'linkedin_clicked', { source: 'main_site' }, 'linkedin'],
    ['#cta-email', 'email_clicked', {}, 'email'],
    ['#cta-schedule', 'calendly_clicked', {}, 'contact'],
    ['#cta-schedule-form', 'calendly_clicked', { source: 'contact_form_alt' }, 'contact']
  ];
  contactBindings.forEach(function (b) {
    var el = document.querySelector(b[0]);
    if (el) el.addEventListener('click', function () {
      track(b[1], b[2]);
      track('cta_clicked', { cta_type: b[3], cta_location: 'contact_section', cta_text: (el.textContent || '').trim(), page: window.location.pathname });
      markEngagedSession(b[1]);
    });
  });

  /* ----------------------------------------------------------
     Section-view tracking. Threshold lowered to 0.2 (from 0.5)
     — a tall section like Experience rarely gets 50% inside the
     viewport at once, which was silently undercounting it
     relative to shorter sections below it. 0.2 is honest for
     sections of any length without needing per-section tuning.
     contact uses its own name (contact_viewed) per the new
     Contact-tracking scheme; the rest keep a *_section_viewed
     naming so it's still checkable in six months.
     ---------------------------------------------------------- */
  var seenSections = {};
  var sectionMap = {
    focus: 'focus_section_viewed',
    experience: 'experience_section_viewed',
    capabilities: 'capabilities_section_viewed',
    about: 'about_section_viewed',
    contact: 'contact_viewed'
  };
  var sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var id = entry.target.id;
      if (entry.isIntersecting && sectionMap[id] && !seenSections[id]) {
        seenSections[id] = true;
        track(sectionMap[id], {});
      }
    });
  }, { threshold: 0.2 });
  Object.keys(sectionMap).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });


  /* ----------------------------------------------------------
     Focus-area cards (customer acquisition / social / campaign
     management). Same principle as the case studies: visibility
     alone isn't engagement, so a card only counts after 5
     cumulative seconds with half of it on screen. The three cards
     sit side by side on desktop, so a plain "visible" event would
     fire for all of them at once.
     ---------------------------------------------------------- */
  var focusState = {};
  document.querySelectorAll('[data-focus]').forEach(function (el) {
    focusState[el.getAttribute('data-focus')] = { ms: 0, since: null, fired: false };
  });
  setInterval(function () {
    Object.keys(focusState).forEach(function (id) {
      var st = focusState[id];
      if (st.since && !st.fired && document.visibilityState === 'visible') {
        st.ms += Date.now() - st.since;
        st.since = Date.now();
        if (st.ms >= 5000) { st.fired = true; track('focus_area_engaged_5s', { focus_area: id }); }
      } else if (st.since) { st.since = Date.now(); }
    });
  }, 1000);
  var focusObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var st = focusState[entry.target.getAttribute('data-focus')];
      if (!st) return;
      st.since = entry.intersectionRatio >= 0.5 ? (st.since || Date.now()) : null;
    });
  }, { threshold: [0, 0.5] });
  document.querySelectorAll('[data-focus]').forEach(function (el) { focusObserver.observe(el); });

  /* ----------------------------------------------------------
     CASE STUDY ENGAGEMENT — the actual fix for the
     "everything fires at once" problem.

     Old behavior: one threshold (0.5), one event, fired the
     moment any case card crossed it. Since all 4 cards sit
     close together on the page, scrolling past the section
     crossed all 4 thresholds within the same second — visually
     correlated, not meaningfully different levels of interest.

     New behavior: each card is tracked independently through
     four distinct, genuinely different signals:
       case_study_opened     — becomes visible at all (10%+)
       case_study_50pct      — half the card has been seen
       case_study_90pct      — nearly the whole card has been seen
       case_study_engaged_15s — cumulative 15+ seconds with at
                                 least 25% of the card visible
                                 (pauses when it drops below 25%
                                 or the tab isn't focused, so
                                 idle/backgrounded time doesn't
                                 count)
     A card scrolled past quickly fires "opened" and maybe
     "50pct" — never "engaged_15s". That's the point.
     ---------------------------------------------------------- */
  var caseCards = document.querySelectorAll('[data-case]');
  var caseState = {};
  caseCards.forEach(function (el, idx) {
    var id = el.getAttribute('data-case');
    caseState[id] = {
      opened: false, fifty: false, ninety: false, engaged: false,
      dwellMs: 0, dwellSince: null, position: idx + 1
    };
  });

  function caseDwellTick() {
    Object.keys(caseState).forEach(function (id) {
      var s = caseState[id];
      if (s.dwellSince && !s.engaged) {
        if (document.visibilityState === 'visible') {
          s.dwellMs += Date.now() - s.dwellSince;
        }
        s.dwellSince = Date.now();
        if (s.dwellMs >= 15000) {
          s.engaged = true;
          track('case_study_engaged_15s', { case_study: id, position: s.position });
          markEngagedSession('case_study_engaged_15s');
        }
      }
    });
  }
  setInterval(caseDwellTick, 1000);

  var caseObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var id = entry.target.getAttribute('data-case');
      var s = caseState[id];
      if (!s) return;
      var ratio = entry.intersectionRatio;

      if (entry.isIntersecting && !s.opened) {
        s.opened = true;
        track('case_study_opened', { case_study: id, position: s.position, source: lastTouch.utm_source || firstTouch.utm_source || 'direct' });
      }
      if (ratio >= 0.5 && !s.fifty) {
        s.fifty = true;
        track('case_study_50pct', { case_study: id, position: s.position });
        markEngagedSession('case_study_50pct');
      }
      if (ratio >= 0.9 && !s.ninety) {
        s.ninety = true;
        track('case_study_90pct', { case_study: id, position: s.position });
      }

      if (ratio >= 0.25) {
        if (!s.dwellSince) s.dwellSince = Date.now();
      } else {
        s.dwellSince = null;
      }
    });
  }, { threshold: [0, 0.1, 0.25, 0.5, 0.9] });
  caseCards.forEach(function (el) { caseObserver.observe(el); });

  /* ----------------------------------------------------------
     Contact form — Formspree. contact_form_started fires once,
     on the first field focus (using focusin, which bubbles,
     rather than focus, which doesn't). contact_form_submitted
     and qualified_contact both fire only on a confirmed 2xx
     response — never on click, never on a failed request.
     ---------------------------------------------------------- */
  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  var submitting = false;
  var formStarted = false;

  if (form) {
    form.addEventListener('focusin', function () {
      if (!formStarted) {
        formStarted = true;
        track('contact_form_started', {});
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return;
      submitting = true;
      if (submitBtn) submitBtn.disabled = true;
      status.textContent = 'Sending…';
      track('cta_clicked', { cta_type: 'contact', cta_location: 'contact_form', cta_text: submitBtn ? (submitBtn.textContent || '').trim() : 'Send message', page: window.location.pathname });

      var data = new FormData(form);
      data.append('first_touch_utm_source', firstTouch.utm_source || '');
      data.append('first_touch_utm_medium', firstTouch.utm_medium || '');
      data.append('first_touch_utm_campaign', firstTouch.utm_campaign || '');
      data.append('last_touch_utm_source', lastTouch.utm_source || '');
      data.append('last_touch_utm_campaign', lastTouch.utm_campaign || '');

      fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          status.textContent = "Thanks — I'll be in touch soon.";
          try {
            var emailVal = form.querySelector('#email') ? form.querySelector('#email').value : undefined;
            var nameVal = form.querySelector('#name') ? form.querySelector('#name').value : undefined;
            var companyVal = form.querySelector('#company') ? form.querySelector('#company').value : undefined;
            if (window.posthog && emailVal && typeof posthog.identify === 'function') {
              posthog.identify(emailVal, { name: nameVal, company: companyVal, email: emailVal });
            }
          } catch (idErr) {}
          setFlag(IDENTIFIED_KEY, '1');
          track('contact_form_submitted', {});
          track('qualified_contact', {});
          markEngagedSession('contact_form_submitted');
          form.reset();
          formStarted = false;
        } else {
          status.textContent = 'Something went wrong — please email me directly instead.';
        }
      }).catch(function () {
        status.textContent = 'Something went wrong — please email me directly instead.';
      }).finally(function () {
        submitting = false;
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }
});
