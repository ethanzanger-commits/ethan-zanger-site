/* ============================================================
   PostHog init — safe by design.
   If this script is blocked (ad blockers, network failure, bad
   key) posthog.init's own stub queue means calls never throw;
   we additionally wrap init itself in try/catch so a malformed
   snippet can never break page load.
   Replace YOUR_POSTHOG_KEY and the api_host below before deploying.
   ============================================================ */
try {
  !function (t, e) {
    var o, n, p, r;
    e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) {
      function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.uploadQueue.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }
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

  posthog.init('phc_vQWFVZTUAUPkGAeUD9tWSwfmkYWVmaWyohFnn64GQFqd', { api_host: 'https://us.i.posthog.com', capture_pageview: true, autocapture: false, disable_session_recording: false });
} catch (err) {
  window.posthog = window.posthog || { capture: function () {} };
}

/* ============================================================
   First-touch attribution — not "session" attribution.
   Stored in localStorage, which persists indefinitely (until
   the visitor clears site data), not just for one browser
   session. So a later CV download or contact form submission
   still carries the *original* UTM values from the visitor's
   first visit, not whatever (if anything) is in the URL now.
   ============================================================ */
var ACQ_KEY = 'ez_acquisition_v1';

function readUTMFromURL() {
  var params = new URLSearchParams(window.location.search);
  var fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var out = {};
  var found = false;
  fields.forEach(function (f) {
    var v = params.get(f);
    if (v) { out[f] = v; found = true; }
  });
  return found ? out : null;
}

function getAcquisition() {
  try {
    var fromUrl = readUTMFromURL();
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(ACQ_KEY)); } catch (e) { stored = null; }

    if (!stored) {
      var acquisition = fromUrl || {};
      acquisition.referrer = document.referrer || '(direct)';
      acquisition.landing_page = window.location.pathname;
      acquisition.first_seen = new Date().toISOString();
      try { localStorage.setItem(ACQ_KEY, JSON.stringify(acquisition)); } catch (e) {}
      return acquisition;
    }
    return stored;
  } catch (err) {
    return {};
  }
}

var acquisition = getAcquisition();

/* ============================================================
   Safe event tracking helper.
   Every event is enriched with the visitor's original
   acquisition properties plus the current page path, so
   attribution survives regardless of when the event fires.
   ============================================================ */
function track(name, props) {
  try {
    if (window.posthog && typeof posthog.capture === 'function') {
      posthog.capture(name, Object.assign(
        {
          utm_source: acquisition.utm_source,
          utm_medium: acquisition.utm_medium,
          utm_campaign: acquisition.utm_campaign,
          utm_content: acquisition.utm_content,
          utm_term: acquisition.utm_term,
          initial_referrer: acquisition.referrer,
          landing_page: acquisition.landing_page,
          page_path: window.location.pathname
        },
        props || {}
      ));
    }
  } catch (err) {
    /* analytics must never break the page */
  }
}

document.addEventListener('DOMContentLoaded', function () {

  /* ----------------------------------------------------------
     Mobile nav toggle — open/close, close on link click,
     close on Escape, keyboard-accessible via native <button>.
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
     CTA click tracking.
     CV_Download_Clicked measures click intent, not a completed
     file save — no client-side API can confirm the browser
     actually wrote the file to disk, so we never claim more
     than "clicked."
     ---------------------------------------------------------- */
  var bindings = [
    ['#cta-download-cv', 'CV_Download_Clicked', { location: 'hero' }],
    ['#cta-download-cv-2', 'CV_Download_Clicked', { location: 'contact' }],
    ['#cta-linkedin', 'LinkedIn_Clicked', {}],
    ['#cta-email', 'Email_Clicked', {}],
    ['#cta-schedule', 'Schedule_Interview_Clicked', {}]
  ];
  bindings.forEach(function (b) {
    var el = document.querySelector(b[0]);
    if (el) el.addEventListener('click', function () { track(b[1], b[2]); });
  });

  /* ----------------------------------------------------------
     Section-view + case-study-view tracking via
     IntersectionObserver — fires once per section/case, only
     after meaningful visibility, never on every scroll tick.
     ---------------------------------------------------------- */
  var seenSections = {};
  var sectionMap = {
    experience: 'Experience_Section_Viewed',
    capabilities: 'Capabilities_Section_Viewed',
    about: 'About_Section_Viewed',
    contact: 'Contact_Section_Viewed'
  };
  var sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var id = entry.target.id;
      if (entry.isIntersecting && sectionMap[id] && !seenSections[id]) {
        seenSections[id] = true;
        track(sectionMap[id], {});
      }
    });
  }, { threshold: 0.5 });
  Object.keys(sectionMap).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });

  var seenCases = {};
  var caseObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var caseId = entry.target.getAttribute('data-case');
      if (entry.isIntersecting && caseId && !seenCases[caseId]) {
        seenCases[caseId] = true;
        track('Case_Study_Viewed', { case: caseId });
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-case]').forEach(function (el) { caseObserver.observe(el); });

  /* ----------------------------------------------------------
     Contact form — Formspree.
     - HTML5 required attributes handle field validation.
     - Submit button disabled for the duration of the request
       to prevent duplicate submissions (double-click, slow
       network retries).
     - Contact_Form_Submitted only fires on a confirmed 2xx
       response from Formspree, never on click.
     - Original acquisition data rides along in the payload so
       you can see which channel produced the lead.
     No API key or secret is used here — Formspree's public
     form endpoint is designed to be called directly from the
     browser.
     ---------------------------------------------------------- */
  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  var submitting = false;

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return;
      submitting = true;
      if (submitBtn) submitBtn.disabled = true;
      status.textContent = 'Sending…';

      var data = new FormData(form);
      data.append('utm_source', acquisition.utm_source || '');
      data.append('utm_medium', acquisition.utm_medium || '');
      data.append('utm_campaign', acquisition.utm_campaign || '');
      data.append('utm_content', acquisition.utm_content || '');
      data.append('initial_referrer', acquisition.referrer || '');

      fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          status.textContent = "Thanks — I'll be in touch soon.";
          track('Contact_Form_Submitted', {});
          form.reset();
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
