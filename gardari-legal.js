/* Gardari legal UI for preview sites. Analytics remains OFF without an approved counter ID.
   On production, gate EVERY optional tracker on the stored choice; one ID here gates Yandex Metrika only. */
(function () {
  'use strict';
  if (window.__gardariLegalModuleLoaded) return;
  window.__gardariLegalModuleLoaded = true;
  var source = document.currentScript;
  var site = source && source.getAttribute('data-gardari-site') || '';
  var metrikaId = Number(source && source.getAttribute('data-metrica-id') || 0);
  var POLICY = 'https://gardari.art/legal/privacy/';
  var KEY = 'gardari-privacy-choice:v2';
  var COOKIE = 'gardari_privacy_choice_v2';
  var selected = null, analyticsLoaded = false, lastTrigger = null, manage = [];

  function element(tag, className, html) {
    var e = document.createElement(tag);
    e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function policyLink() {
    return '<a href="' + POLICY + '" target="_blank" rel="noopener noreferrer">Политика персональных данных</a>';
  }
  function requisites() {
    return '<details class="gardari-legal-details"><summary>Реквизиты и контакты</summary>' +
      '<div class="gardari-legal-details-content"><strong>ИП Гардари Денис Михайлович</strong>' +
      '<p>ИНН 666200028640<br>ОГРНИП 312668634500040</p>' +
      '<p>Адрес для корреспонденции: Екатеринбург, ул. Азина, 22/2, офис 8</p>' +
      '<p><a href="mailto:kb@gardari.art">kb@gardari.art</a></p></div></details>';
  }
  function manageButton(label) {
    var btn = element('button', 'gardari-legal-manage', label || 'Настройки cookie');
    btn.type = 'button';
    btn.hidden = true;
    btn.setAttribute('aria-controls', 'gardari-legal-consent');
    btn.setAttribute('aria-label', 'Изменить разрешение на аналитику');
    manage.push(btn);
    btn.addEventListener('click', function () {
      lastTrigger = btn;
      show(true);
    });
    return btn;
  }
  function createLegalFooter() {
    var f = element('footer', 'gardari-legal-footer');
    f.setAttribute('aria-label', 'Правовая информация');
    var copy = element('span', 'gardari-legal-copyright', '© 2026 Гардари');
    f.append(copy);
    var holder = element('span', 'gardari-legal-policy', policyLink());
    f.append(holder);
    var details = element('span', 'gardari-legal-requisites');
    details.innerHTML = requisites();
    f.append(details);
    f.append(manageButton());
    document.body.append(f);
  }
  function augmentExistingFooter() {
    var f = document.querySelector('#site-footer .footer-legal');
    if (!f) { createLegalFooter(); return; }
    var existing = f.querySelector('a[href="privacy.html"], a.footer-policy');
    if (existing) {
      existing.href = POLICY;
      existing.target = '_blank';
      existing.rel = 'noopener noreferrer';
    } else {
      f.append(element('span', 'gardari-legal-policy', policyLink()));
    }
    if (site === 'tools') {
      var details = element('span', 'gardari-legal-requisites');
      details.innerHTML = requisites();
      f.append(details);
    }
    f.append(manageButton('Изменить выбор cookie'));
  }
  function storedChoice() {
    var hostname = location.hostname;
    if (hostname === 'gardari.art' || hostname.endsWith('.gardari.art')) {
      var pair = document.cookie.split('; ').find(function (v) { return v.indexOf(COOKIE + '=') === 0; });
      if (pair) {
        var c = pair.slice(COOKIE.length + 1);
        if (c === 'yes' || c === 'no') return c === 'yes';
      }
    }
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (data && data.version === 2 && typeof data.analytics === 'boolean') return data.analytics;
    } catch (_) {}
    return null;
  }
  function storeChoice(yes) {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 2, analytics: yes, updatedAt: new Date().toISOString() })); } catch (_) {}
    if (location.hostname === 'gardari.art' || location.hostname.endsWith('.gardari.art')) {
      document.cookie = COOKIE + '=' + (yes ? 'yes' : 'no') + '; Domain=.gardari.art; Path=/; Max-Age=15552000; Secure; SameSite=Lax';
    }
  }
  function enableMetrikaIfConfigured() {
    if (analyticsLoaded || !Number.isSafeInteger(metrikaId) || metrikaId <= 0) return;
    analyticsLoaded = true;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = window.ym.l || Date.now();
    window.ym(metrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://mc.yandex.ru/metrika/tag.js';
    tag.setAttribute('data-gardari-analytics', 'consent-gated');
    document.head.append(tag);
  }
  var panel = element('section', 'gardari-legal-consent',
    '<div class="gardari-legal-copy">' +
      '<h2 id="gardari-legal-title">Cookie и аналитика</h2>' +
      '<p id="gardari-legal-description">Мы используем cookie. Аналитика — только с вашего разрешения.</p>' +
      '<a href="' + POLICY + '" target="_blank" rel="noopener noreferrer">Политика персональных данных</a>' +
    '</div>' +
    '<div class="gardari-legal-actions">' +
      '<button type="button" class="gardari-legal-allow">Разрешить аналитику</button>' +
      '<button type="button" class="gardari-legal-deny">Только необходимые</button>' +
    '</div>');
  panel.id = 'gardari-legal-consent';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'gardari-legal-title');
  panel.setAttribute('aria-describedby', 'gardari-legal-description');
  function show(focus) {
    panel.hidden = false;
    manage.forEach(function (b) { b.hidden = true; });
    if (focus) panel.querySelector('.gardari-legal-deny').focus();
  }
  function hide() {
    panel.hidden = true;
    manage.forEach(function (b) { b.hidden = false; });
    if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
    lastTrigger = null;
  }
  function choose(yes) {
    var wasRunning = analyticsLoaded;
    selected = yes;
    storeChoice(yes);
    hide();
    window.dispatchEvent(new CustomEvent('gardari:privacy-choice', { detail: { analytics: yes } }));
    if (yes) enableMetrikaIfConfigured();
    else if (wasRunning) location.reload();
  }
  function init() {
    if (site === 'kb' || site === 'tools') augmentExistingFooter();
    else createLegalFooter();
    document.body.append(panel);
    panel.querySelector('.gardari-legal-allow').addEventListener('click', function () { choose(true); });
    panel.querySelector('.gardari-legal-deny').addEventListener('click', function () { choose(false); });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && selected !== null) { e.preventDefault(); hide(); }
    });
    window.GardariPrivacyChoice = Object.freeze({
      analyticsAllowed: function () { return selected === true; },
      openSettings: function () { show(true); }
    });
    selected = storedChoice();
    if (selected === null) show(false);
    else {
      hide();
      if (selected) enableMetrikaIfConfigured();
      if (new URLSearchParams(location.search).get('cookie-settings') === 'open') show(false);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();