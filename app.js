(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const intro = $('#intro');
  const appShell = $('#app-shell');
  const introAccess = $('#intro-access');
  const introPassword = $('#intro-password');
  const introPasswordError = $('#intro-password-error');
  const liveStatus = $('#live-status');
  const NS = 'http://www.w3.org/2000/svg';
  let introFrame = null;
  let introHideTimer = null;
  let introLayout = [];
  let introAnimationStart = null;
  let introLogoParticles = [];
  let logoImagePending = false;
  let introUnlocked = false;
  let currentChapter = 1;
  let currentMode = 3;
  let lastDialogOpener = null;

  // Standalone adaptation of the principles in the MIT-licensed Stroke Draw Type
  // by Isaiah Bjork: glyph-based dash drawing, moving pen tip, wavy masked fill.
  // The original React component is not bundled with this static prototype.
  const SPLASH_ONLY = false;
  // Temporary shared entrance gate for the static preview, not server authentication.
  const INTRO_PASSWORD = '1991';
  const INTRO_TITLE = 'HOMO COGITANS';
  const INTRO_SUBTITLE = Array.from('НОВАЯ ТЕОРИЯ МЫШЛЕНИЯ');
  const INTRO_DRAW_START = .22;
  const INTRO_DRAW_STAGGER = .068;
  const INTRO_DRAW_DURATION = 1.18;
  const INTRO_FILL_STAGGER = .03;
  const INTRO_FILL_DURATION = 1.17;
  const INTRO_TYPE_INTERVAL = .065;
  const INTRO_LOGO_DURATION = 1.28;
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const smooth01 = value => { const t = clamp01(value); return t*t*(3-2*t); };

  function bezierEase(value, x1, y1, x2, y2) {
    const p = clamp01(value);
    let t = p;
    for (let i = 0; i < 5; i++) {
      const inv = 1 - t;
      const x = 3 * inv * inv * t * x1 + 3 * inv * t * t * x2 + t * t * t;
      const derivative = 3 * inv * inv * x1 + 6 * inv * t * (x2 - x1) + 3 * t * t * (1 - x2);
      if (derivative < .0001) break;
      t = clamp01(t - (x - p) / derivative);
    }
    const inv = 1 - t;
    return 3 * inv * inv * t * y1 + 3 * inv * t * t * y2 + t * t * t;
  }

  function makeGlyph(parent, ch, x, className) {
    const element = document.createElementNS(NS, 'text');
    element.setAttribute('x', String(x));
    element.setAttribute('y', '175');
    element.classList.add('intro-glyph', className);
    element.textContent = ch;
    parent.appendChild(element);
    return element;
  }

  function buildIntroLetters() {
    const measure = $('#intro-measure');
    const outline = $('#intro-outline');
    const fill = $('#intro-fill-group');
    const tips = $('#intro-pen-tips');
    const surfaces = $('#intro-liquid-surfaces');
    outline.replaceChildren();
    fill.replaceChildren();
    tips.replaceChildren();
    surfaces.replaceChildren();
    fill.setAttribute('mask', 'url(#intro-fill-mask)');
    measure.textContent = INTRO_TITLE;
    measure.setAttribute('x', '0');
    const originalBox = measure.getBBox();
    measure.setAttribute('x', String((1600 - originalBox.width) / 2 - originalBox.x));
    const box = measure.getBBox();
    const top = box.y - 15;
    const bottom = box.y + box.height + 17;
    introLayout = [];

    Array.from(INTRO_TITLE).forEach((ch, index) => {
      if (!ch.trim()) return;
      const start = measure.getStartPositionOfChar(index);
      const extent = measure.getExtentOfChar(index);
      const left = extent.x;
      const right = extent.x + extent.width;
      const dash = Math.min(900, 2.4 * extent.width + 155);
      const filledLetter = makeGlyph(fill, ch, start.x, 'intro-fill-char');
      const strokeLetter = makeGlyph(outline, ch, start.x, 'draw-char');
      const penLetter = makeGlyph(tips, ch, start.x, 'intro-pen-char');
      const surface = document.createElementNS(NS, 'path');
      surfaces.appendChild(surface);
      const drops = [];
      for (let k = 0; k < 2; k++) {
        const drop = document.createElementNS(NS, 'circle');
        drop.setAttribute('cx', String(left + extent.width * (.3 + k * .4)));
        drop.setAttribute('r', String(3.6 + k * 1.1));
        drop.style.opacity = '0';
        surfaces.appendChild(drop);
        drops.push(drop);
      }
      strokeLetter.style.strokeDasharray = `${dash} ${dash}`;
      strokeLetter.style.strokeDashoffset = String(dash);
      penLetter.style.opacity = '0';
      introLayout.push({left,right,top,bottom,dash,strokeLetter,penLetter,filledLetter,surface,drops});
    });
  }

  // Pixel-sample the author's original logo: particles resolve into its
  // silhouette, not an approximated SVG or a second typographic 'x.0'.
  function buildIntroLogoParticles() {
    const canvas = $('#intro-logo-particles');
    const image = $('#intro-logo-final');
    if (!canvas || !image.naturalWidth) return;
    const width = Math.round(canvas.getBoundingClientRect().width);
    const height = Math.round(canvas.getBoundingClientRect().height);
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);

    const sampler = document.createElement('canvas');
    sampler.width = width;
    sampler.height = height;
    const context = sampler.getContext('2d', {willReadFrequently:true});
    context.drawImage(image, -width*.15, -height*.15, width*1.3, height*1.3);
    const {data} = context.getImageData(0,0,width,height);
    const step = width < 105 ? 3.1 : 3.8;
    introLogoParticles = [];
    for (let y = 1; y < height-1; y+=step) {
      for (let x = 1; x < width-1; x+=step) {
        const offset = (Math.floor(y)*width + Math.floor(x))*4;
        const darkness = (data[offset]+data[offset+1]+data[offset+2])/3;
        if (darkness > 115 || Math.random()<.055) continue;
        const angle = Math.random()*Math.PI*2;
        const radius = (18+Math.random()*Math.max(width,height)*.85);
        introLogoParticles.push({
          tx:x,ty:y,
          sx:x+Math.cos(angle)*radius,
          sy:y+Math.sin(angle)*radius,
          delay:Math.random()*.24,
          radius:.65+Math.random()*.62,
          wobble:Math.random()*Math.PI*2
        });
      }
    }
  }

  function prepareIntroLogo() {
    const canvas = $('#intro-logo-particles');
    const image = $('#intro-logo-final');
    introLogoParticles = [];
    image.style.opacity = '0';
    canvas.style.opacity = '0';
    if (image.complete && image.naturalWidth) buildIntroLogoParticles();
    else if (!logoImagePending) {
      logoImagePending = true;
      image.addEventListener('load', () => {
        logoImagePending = false;
        buildIntroLogoParticles();
      }, {once:true});
    }
  }

  function paintIntroLogo(time, start, duration) {
    const canvas = $('#intro-logo-particles');
    const image = $('#intro-logo-final');
    if (time < start) return;
    const phase = clamp01((time - start) / duration);
    // Let the true mark gradually emerge *under* the assembling particles.
    // The old late crossfade made a visible jump from sparse dots to the solid mark.
    const solid = introLogoParticles.length ? smooth01((phase - .34) / .66) : smooth01(phase);
    image.style.opacity = String(solid);
    if (!introLogoParticles.length) return;
    canvas.style.opacity = String(1-solid);
    const context = canvas.getContext('2d');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.clearRect(0,0,width,height);
    if (phase >= 1) return;
    for (const point of introLogoParticles) {
      const progress = clamp01((time - start - point.delay) / (duration - point.delay));
      if (!progress) continue;
      const ease = bezierEase(progress,.17,.9,.24,1);
      const residual = 1-ease;
      const tremor = Math.sin(progress*13+point.wobble)*3.5*residual;
      const x = point.sx+(point.tx-point.sx)*ease+Math.cos(point.wobble)*tremor;
      const y = point.sy+(point.ty-point.sy)*ease+Math.sin(point.wobble)*tremor;
      const alpha = Math.min(1,progress*6) * (.75+.25*progress);
      context.fillStyle = `rgba(104,141,165,${alpha})`;
      const size = point.radius*(1+.26*residual);
      context.fillRect(x,y,size,size);
    }
  }

  function stopIntroAnimation() {
    if (introFrame !== null) cancelAnimationFrame(introFrame);
    if (introHideTimer !== null) clearTimeout(introHideTimer);
    introFrame = null;
    introHideTimer = null;
    introAnimationStart = null;
  }

  function finishIntro(instant = false) {
    if (!introUnlocked) return;
    stopIntroAnimation();
    appShell.classList.add('visible');
    appShell.setAttribute('aria-hidden', 'false');
    appShell.inert = false;
    document.body.style.overflow = '';
    introPassword.value = '';
    $('#main-content').focus({preventScroll:true});
    if (instant) {
      intro.hidden = true;
      intro.classList.remove('playing', 'typing', 'typed', 'exit');
      return;
    }
    intro.classList.add('exit');
    introHideTimer = setTimeout(() => { intro.hidden = true; }, 650);
  }

  function paintIntroFrame(now) {
    if (introAnimationStart === null) introAnimationStart = now;
    const time = (now - introAnimationStart) / 1000;
    const count = introLayout.length;
    const strokeEnd = INTRO_DRAW_START + Math.max(0,count - 1) * INTRO_DRAW_STAGGER + INTRO_DRAW_DURATION;
    const fillStart = strokeEnd + .12;
    const fillEnd = fillStart + Math.max(0,count - 1) * INTRO_FILL_STAGGER + INTRO_FILL_DURATION;
    // Start typing while the final contour strokes are still being drawn.
    const typingStart = strokeEnd - .55;
    const typingEnd = typingStart + INTRO_SUBTITLE.length * INTRO_TYPE_INTERVAL;
    // Begin the particle assembly halfway through the title's contour drawing,
    // while keeping the exact completion time of the previously accepted splash.
    const logoStart = INTRO_DRAW_START + (strokeEnd - INTRO_DRAW_START) * .5;
    const logoEnd = typingStart + INTRO_SUBTITLE.length * INTRO_TYPE_INTERVAL * .5 + INTRO_LOGO_DURATION;
    if (time >= logoStart && !intro.classList.contains('access-visible')) {
      intro.classList.add('access-visible');
      introAccess.inert = false;
    }
    let fullyFilled = true;

    introLayout.forEach((letter,index) => {
      const drawn = bezierEase((time - INTRO_DRAW_START - index * INTRO_DRAW_STAGGER) / INTRO_DRAW_DURATION, .55,.06,.35,1);
      const filled = bezierEase((time - fillStart - index * INTRO_FILL_STAGGER) / INTRO_FILL_DURATION, .3,0,.2,1);
      if (drawn >= .999) {
        letter.strokeLetter.style.strokeDasharray = 'none';
        letter.strokeLetter.style.strokeDashoffset = '0';
      } else {
        letter.strokeLetter.style.strokeDasharray = `${letter.dash} ${letter.dash}`;
        letter.strokeLetter.style.strokeDashoffset = String(letter.dash * (1 - drawn));
      }
      letter.strokeLetter.style.opacity = drawn > 0 ? '1' : '0';
      const tipVisible = drawn > .01 && drawn < .99 ? Math.min(1,drawn * 12,(1-drawn)*9) : 0;
      letter.penLetter.style.strokeDasharray = '8 1800';
      letter.penLetter.style.strokeDashoffset = String(-(drawn * letter.dash - 8));
      letter.penLetter.style.opacity = String(tipVisible * .8);

      if (filled < .999) fullyFilled = false;
      const {left,right,top,bottom} = letter;
      const y = bottom + 23 + (top - bottom - 48) * filled;
      const amplitude = 10 * Math.sin(Math.PI * filled);
      let path = `M${left-9} ${bottom+45}L${left-9} ${y}`;
      for (let k = 0; k <= 10; k++) {
        const x = left - 9 + ((right - left + 18) * k / 10);
        const wave = amplitude * Math.sin(x * .10 + time * 7 + index) + amplitude * .45 * Math.sin(x * .24 - time * 4);
        path += `L${x.toFixed(2)} ${(y+wave).toFixed(2)}`;
      }
      path += `L${right+9} ${bottom+45}Z`;
      letter.surface.setAttribute('d', path);
      letter.drops.forEach((drop,k) => {
        drop.setAttribute('cy', String(y + 7 + k * 2 + amplitude * .22));
        drop.style.opacity = filled > .08 && filled < .9 ? String(.7 * Math.sin(Math.PI * filled)) : '0';
      });
    });
    if (fullyFilled) $('#intro-fill-group').removeAttribute('mask');

    if (time >= typingStart) {
      intro.classList.add('typing');
      const length = Math.min(INTRO_SUBTITLE.length, Math.floor((time - typingStart) / INTRO_TYPE_INTERVAL) + 1);
      $('#typed-subtitle').textContent = INTRO_SUBTITLE.slice(0,length).join('');
      if (length === INTRO_SUBTITLE.length) intro.classList.add('typed');
    }
    paintIntroLogo(time,logoStart,logoEnd-logoStart);
    // Keep driving the SVG until BOTH animations have finished. The accelerated
    // typewriter can end before the liquid fill, so ending on typingEnd alone
    // would leave the title partially filled and apparently frozen.
    if (time >= Math.max(strokeEnd, fillEnd, typingEnd, logoEnd)) {
      introFrame = null;
      return;
    }
    introFrame = requestAnimationFrame(paintIntroFrame);
  }

  function playIntro() {
    stopIntroAnimation();
    intro.hidden = false;
    introUnlocked = false;
    introPassword.value = '';
    introPassword.removeAttribute('aria-invalid');
    introPasswordError.textContent = '';
    introAccess.querySelector('button').disabled = false;
    intro.classList.remove('playing', 'typing', 'typed', 'exit', 'access-visible');
    introAccess.inert = true;
    $('#typed-subtitle').textContent = '';
    prepareIntroLogo();
    document.body.style.overflow = 'hidden';
    appShell.setAttribute('aria-hidden', 'true');
    appShell.inert = true;
    appShell.classList.remove('visible');
    buildIntroLetters();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      introLayout.forEach(({strokeLetter}) => {
        strokeLetter.style.opacity = '1';
        strokeLetter.style.strokeDasharray = 'none';
        strokeLetter.style.strokeDashoffset = '0';
      });
      $('#intro-fill-group').removeAttribute('mask');
      $('#typed-subtitle').textContent = INTRO_SUBTITLE.join('');
      intro.classList.add('typing', 'typed');
      intro.classList.add('access-visible');
      introAccess.inert = false;
      paintIntroLogo(1,0,1);
      intro.focus({preventScroll:true});
      return;
    }
    intro.focus({preventScroll:true});
    intro.classList.add('playing');
    introFrame = requestAnimationFrame(paintIntroFrame);
  }

  const routeNames = {
    overview: 'Главная', schemes: 'Схемы х.0', game: 'Игра х.0', examples: 'Примеры х.0',
    book: 'Книга', map: 'Мета-Карта х.0',
    master: 'Мастер-текст', treatise: 'Трактат', essays: 'Корпус эссе', lab: 'Лаборатория', journal: 'Дневник'
  };

  function closeMobileMenu() {
    $('#sidebar').classList.remove('open');
    $('#mobile-scrim').classList.remove('open');
    $('#mobile-menu').setAttribute('aria-expanded', 'false');
  }

  function goTo(route, options = {}) {
    const routeName = String(route || '').split('/')[0];
    const next = routeNames[routeName] ? routeName : 'overview';
    appShell.classList.toggle('blog-view', next === 'overview');
    $$('.page-view').forEach(node => node.classList.toggle('active', node.dataset.view === next));
    $$('[data-route]').forEach(node => {
      if (!node.classList.contains('side-link') && !node.classList.contains('nav-card')) return;
      const chosen = node.dataset.route === next;
      node.classList.toggle(node.classList.contains('side-link') ? 'active' : 'selected', chosen);
      if (chosen) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    });
    if (options.updateHash !== false) history.replaceState(null, '', next === 'overview' ? location.pathname : `#${next}`);
    closeMobileMenu();
    $('#site-search').value = '';
    $('#search-results').hidden = true;
    window.scrollTo({ top: 0, behavior: 'instant' });
    liveStatus.textContent = `Раздел: ${routeNames[next]}`;
    document.dispatchEvent(new CustomEvent('hc:route-changed', {detail:{route:next}}));
    const heading = $(`.page-view[data-view="${next}"] h1`);
    if (heading) { heading.setAttribute('tabindex','-1'); heading.focus({preventScroll:true}); }
  }

  const modes = [1,2,3,4,5,6];
  function buildMap(svg) {
    if (!svg) return;
    const cx = 310, cy = 236, radius = 178;
    const positions = modes.map((n, i) => {
      const rad = ((i * 60 - 90) * Math.PI) / 180;
      return { n, x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
    });
    const create = (tag, attrs = {}, parent = svg) => {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([key,value]) => el.setAttribute(key, String(value)));
      parent.appendChild(el);
      return el;
    };
    svg.replaceChildren();
    create('circle', {class:'mode-ring', cx, cy, r:217});
    create('circle', {class:'mode-ring', cx, cy, r:178});
    create('circle', {class:'mode-ring', cx, cy, r:100});
    create('ellipse', {class:'mode-ring', cx, cy, rx:246, ry:102, transform:`rotate(-31 ${cx} ${cy})`});
    create('ellipse', {class:'mode-ring', cx, cy, rx:235, ry:110, transform:`rotate(53 ${cx} ${cy})`});
    for (let i = 0; i < 36; i++) {
      const r1 = 226, r2 = i % 3 === 0 ? 236 : 231;
      const angle = i * Math.PI / 18;
      create('line', {class:'axis-tick',x1:cx+Math.cos(angle)*r1,y1:cy+Math.sin(angle)*r1,x2:cx+Math.cos(angle)*r2,y2:cy+Math.sin(angle)*r2});
    }
    positions.forEach((p, i) => {
      const next = positions[(i + 1) % positions.length];
      create('path', {class:'mode-link',d:`M ${p.x} ${p.y} Q ${cx} ${cy} ${next.x} ${next.y}`});
      create('path', {class:'mode-link strong',d:`M ${p.x} ${p.y} Q ${cx+(p.x-cx)*.18} ${cy+(p.y-cy)*.18} ${cx} ${cy}`});
    });
    create('circle', {cx,cy,r:62,fill:'#e2e7e9',stroke:'#677985','stroke-width':1.2});
    create('circle', {cx,cy,r:47,fill:'none',stroke:'#9aaab3','stroke-width':1,'stroke-dasharray':'2 5'});
    const center = create('text', {class:'center-mark',x:cx,y:cy+13,'text-anchor':'middle'});
    center.textContent = 'х.0';
    const centerCaption = create('text', {class:'center-caption',x:cx,y:cy+36,'text-anchor':'middle'});
    centerCaption.textContent = 'МЫШЛЕНИЕ';
    const tagTop = create('text',{class:'orbital-label',x:42,y:29});
    tagTop.textContent='HUMAN / COGNITION';
    const tagBottom = create('text',{class:'orbital-label',x:436,y:458});
    tagBottom.textContent='ATLAS · 006';
    positions.forEach(p => {
      const node = create('g', {class:'node-target', 'data-mode':p.n, role:'button', tabindex:'0', 'aria-label':`Выбрать режим мышления ${p.n}.0`});
      create('circle', {class:'node-circle',cx:p.x,cy:p.y,r:28}, node);
      const text = create('text',{class:'node-number',x:p.x,y:p.y+1},node);
      text.textContent=`${p.n}.0`;
      const tick = create('line',{class:'node-tick',x1:p.x,y1:p.y-43,x2:p.x,y2:p.y-32},node);
      node.addEventListener('click', () => chooseMode(p.n));
      node.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseMode(p.n); }
      });
    });
  }

  function chooseMode(number) {
    currentMode = number;
    if (!$('#mode-number')) return;
    $$('.node-target').forEach(node => {
      const active = Number(node.dataset.mode) === number;
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    $('#map-selected-label').textContent = `РЕЖИМ ${number}.0`;
    $('#mode-number').textContent = `${number}.0`;
    $('#mode-heading').textContent = `Режим мышления ${number}.0`;
    $('#mode-description').textContent = `Узел ${number}.0. Здесь будут доступны определения, примеры, исторические сцены, ограничения и связи с другими режимами — по принятой версии теории.`;
    liveStatus.textContent = `Выбран режим мышления ${number}.0`;
  }

  function chooseChapter(number) {
    if (!Number.isInteger(number) || number < 1 || number > 3) return;
    currentChapter = number;
    const entry = window.HC_TEXT_INDEX?.book.groups[number-1];
    if (!entry) return;
    liveStatus.textContent = entry.label;
    document.dispatchEvent(new CustomEvent('hc:chapter', {detail:{number,title:entry.label}}));
  }

  const experimentAnswers = {
    observe:'Что именно можно установить по самому следу, не добавляя предположений о его происхождении?',
    explain:'Какие разные причины могли оставить этот след — и что позволило бы проверить каждую версию?',
    compare:'Как изменяется вывод, если сопоставить несколько объяснений и указать границы каждого?'
  };
  function initializeExperiment() {
    $$('.exp-tab').forEach(button => button.addEventListener('click', () => {
      $$('.exp-tab').forEach(item => item.classList.toggle('selected', item === button));
      $('#experiment-answer').textContent = experimentAnswers[button.dataset.experiment];
    }));
  }

  const searchItems = [
    {label:'Главная — обзор исследования',route:'overview',terms:'вход обзор старт'},
    {label:'HOMO COGITANS — книга',route:'book',terms:'читать главы рукопись'},
    {label:'Мета-Карта х.0',route:'map',terms:'шесть режимов мышления схема атлас'},
    {label:'Мастер-текст',route:'master',terms:'основа теория понятия'},
    {label:'Трактат',route:'treatise',terms:'углубление аппарат'},
    {label:'Лаборатория',route:'lab',terms:'игра практики опыт'},
    {label:'Дневник исследования',route:'journal',terms:'новости развитие журнал'},
    ...(window.HC_TEXT_INDEX?.book.groups.slice(0,3)||[]).map((entry,i) => ({label:entry.label,route:'book',chapter:i+1,terms:`глава ${i+1}`}))
  ];

  function initializeSearch() {
    const input = $('#site-search');
    const results = $('#search-results');
    function search() {
      const needle = input.value.trim().toLocaleLowerCase('ru');
      if (!needle) { results.hidden = true; return; }
      const found = searchItems.filter(item => `${item.label} ${item.terms}`.toLocaleLowerCase('ru').includes(needle)).slice(0,6);
      results.replaceChildren();
      if (!found.length) {
        const empty = document.createElement('p');
        empty.className = 'micro';
        empty.style.padding = '7px 13px';
        empty.textContent = 'В ПРОТОТИПЕ ПОКА НЕТ СОВПАДЕНИЙ';
        results.appendChild(empty);
      }
      found.forEach((item,index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'search-result';
        const counter = document.createElement('small');
        counter.textContent = String(index+1).padStart(2,'0');
        const label = document.createElement('span');
        label.textContent = item.label;
        button.append(counter,label);
        button.addEventListener('click', () => {
          goTo(item.route);
          if (item.chapter) chooseChapter(item.chapter);
        });
        results.appendChild(button);
      });
      results.hidden = false;
    }
    input.addEventListener('input', search);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { results.hidden = true; input.blur(); }
      if (event.key === 'Enter') { const first = $('.search-result', results); if (first) first.click(); }
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.search-pill')) results.hidden = true;
    });
  }

  function closeDialog() {
    $('#subscribe-dialog').hidden = true;
    if (lastDialogOpener) lastDialogOpener.focus();
  }

  function initializeDialog() {
    function openSubscription(opener) {
      lastDialogOpener = opener;
      $('#subscribe-dialog').hidden = false;
      $('#dialog-close').focus();
    }
    $('#subscribe-side').addEventListener('click', event => openSubscription(event.currentTarget));
    document.addEventListener('click', event => {
      const opener = event.target.closest('[data-subscribe]');
      if (opener) openSubscription(opener);
    });
    $('#dialog-close').addEventListener('click', closeDialog);
    $('#dialog-understood').addEventListener('click', closeDialog);
    $('#subscribe-dialog').addEventListener('click', event => { if (event.target.id === 'subscribe-dialog') closeDialog(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('#subscribe-dialog').hidden) closeDialog();
    });
  }

  function initializeNavigation() {
    document.addEventListener('click', event => {
      const node = event.target.closest('[data-route]');
      if (node) goTo(node.dataset.route);
    });
    document.addEventListener('hc:navigate', event => {
      const detail = event.detail || {};
      goTo(detail.route || 'overview');
      if (detail.chapter) chooseChapter(Number(detail.chapter));
      if (detail.source) document.dispatchEvent(new CustomEvent('hc:source', {detail:{part:detail.source}}));
      if (detail.groupId) document.dispatchEvent(new CustomEvent('hc:reader-request', {detail:{route:detail.route,groupId:detail.groupId,line:detail.line}}));
    });
    $('#mobile-menu').setAttribute('aria-expanded','false');
    $('#mobile-menu').addEventListener('click', () => {
      const open = !$('#sidebar').classList.contains('open');
      $('#sidebar').classList.toggle('open',open);
      $('#mobile-scrim').classList.toggle('open',open);
      $('#mobile-menu').setAttribute('aria-expanded',String(open));
    });
    $('#sidebar-close').addEventListener('click',closeMobileMenu);
    $('#mobile-scrim').addEventListener('click',closeMobileMenu);
    window.addEventListener('hashchange', () => goTo(location.hash.slice(1),{updateHash:false}));
    goTo(location.hash.slice(1) || 'overview',{updateHash:false});
  }

  function init() {
    if (SPLASH_ONLY) {
      appShell.hidden = true;
      playIntro();
      return;
    }
    introAccess.addEventListener('submit', event => {
      event.preventDefault();
      if (introUnlocked) return;
      if (introPassword.value !== INTRO_PASSWORD) {
        introPassword.setAttribute('aria-invalid', 'true');
        introPasswordError.textContent = introPassword.value ? 'Неверный пароль. Попробуйте ещё раз.' : 'Введите пароль.';
        introPassword.focus({preventScroll:true});
        introPassword.select();
        return;
      }
      introUnlocked = true;
      introAccess.querySelector('button').disabled = true;
      finishIntro(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    });
    introPassword.addEventListener('input', () => {
      introPassword.removeAttribute('aria-invalid');
      introPasswordError.textContent = '';
    });
    intro.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      if (introAccess.inert) { event.preventDefault(); return; }
      const submit = introAccess.querySelector('button');
      if (event.shiftKey && (document.activeElement === introPassword || document.activeElement === intro)) {
        event.preventDefault();
        submit.focus();
      } else if (!event.shiftKey && (document.activeElement === submit || document.activeElement === intro)) {
        event.preventDefault();
        introPassword.focus();
      }
    });
    $('#replay-intro').addEventListener('click',playIntro);
    buildMap($('#mode-map'));
    buildMap($('#mode-map-large'));
    chooseMode(currentMode);
    initializeExperiment();
    initializeNavigation();
    initializeSearch();
    initializeDialog();
    playIntro();
  }

  document.addEventListener('DOMContentLoaded',init);
})();
