(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  gsap.registerPlugin(ScrollTrigger, SplitText);
  const mm = gsap.matchMedia();

  /* ---------- Lenis smooth scroll (spec 08: lerp 0.1) ---------- */
  let lenis = null;
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // released when the intro wipe clears
  }

  const scrollToTarget = (target) => {
    if (lenis) {
      lenis.scrollTo(target, { offset: target === 0 || target === '#top' ? 0 : -80, duration: 1.3 });
    } else {
      const el = typeof target === 'string' ? document.querySelector(target) : null;
      if (el) el.scrollIntoView();
      else window.scrollTo(0, 0);
    }
  };

  /* ---------- Anchor links ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href');
      if (!hash || hash === '#') return;
      e.preventDefault();
      if (document.body.classList.contains('menu-open')) toggleMenu();
      scrollToTarget(hash === '#top' ? 0 : hash);
    });
  });
  document.querySelector('.footer__top')?.addEventListener('click', () => scrollToTarget(0));
  document.querySelector('.hero__cue-circle')?.addEventListener('click', () => scrollToTarget('#work'));

  /* ---------- Custom cursor (spec 08: dot + trailing ring) ---------- */
  if (finePointer && !reduced) {
    const cursor = document.querySelector('.cursor');
    const dot = document.querySelector('.cursor__dot');
    const ring = document.querySelector('.cursor__ring');
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.06, ease: 'none' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.06, ease: 'none' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    window.addEventListener('mousemove', (e) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    });
    document.querySelectorAll('[data-cursor]').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('cursor--big'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('cursor--big'));
    });
  }

  /* ---------- Magnetic elements (specs 04 & 08) ---------- */
  if (finePointer && !reduced) {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const strength = 0.35;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * strength);
        yTo((e.clientY - r.top - r.height / 2) * strength);
      });
      el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- Mobile menu ---------- */
  const burger = document.querySelector('.nav__burger');
  const menu = document.querySelector('.menu');
  let menuTl = null;
  const toggleMenu = () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-hidden', !open);
    if (reduced) {
      menu.style.visibility = open ? 'visible' : 'hidden';
      menu.style.clipPath = open ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)';
      return;
    }
    if (!menuTl) {
      menuTl = gsap.timeline({
        paused: true,
        onReverseComplete: () => gsap.set(menu, { visibility: 'hidden' }),
      });
      menuTl
        .set(menu, { visibility: 'visible' })
        .to(menu, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power4.inOut' })
        .from('.menu__links a', { y: 48, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' }, '-=0.25')
        .from('.menu__mail', { opacity: 0, duration: 0.4 }, '-=0.3');
    }
    if (open) { menuTl.play(); lenis?.stop(); }
    else { menuTl.reverse(); if (!document.body.classList.contains('is-loading')) lenis?.start(); }
  };
  burger?.addEventListener('click', toggleMenu);

  /* ---------- Eyebrow terminal typing (spec 02) ---------- */
  const typeEyebrow = () => {
    const wrap = document.querySelector('.hero__eyebrow');
    const out = wrap.querySelector('.hero__type');
    const full = wrap.dataset.text;
    if (reduced) { out.textContent = full; wrap.querySelector('.hero__caret').style.display = 'none'; return; }
    let i = 0;
    const tick = () => {
      out.textContent = full.slice(0, ++i);
      if (i < full.length) setTimeout(tick, 26);
      else gsap.to('.hero__caret', { opacity: 0, duration: 0.3, delay: 1.4 });
    };
    tick();
  };

  /* ---------- Intro wipe + hero headline (specs 02 & 08) ---------- */
  const runIntro = () => {
    if (reduced) {
      document.body.classList.remove('is-loading');
      typeEyebrow();
      return;
    }
    // 'words,chars' so lines wrap by word, never mid-word
    const split1 = new SplitText('.hero__line--solid', { type: 'words,chars', mask: 'chars' });
    const split2 = new SplitText('.hero__line--outline', { type: 'words,chars', mask: 'chars' });
    gsap.set([...split1.chars, ...split2.chars], { yPercent: 120, rotate: 6 });
    gsap.set('.hero__intro, .hero__cue', { opacity: 0, y: 24 });
    gsap.set('.nav', { opacity: 0, y: -16 });

    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.to('.wipe__word', { opacity: 1, duration: 0.45, ease: 'power2.out' })
      .fromTo('.wipe__word', { scale: 0.96 }, { scale: 1.04, duration: 0.7, ease: 'power1.inOut' }, '<')
      .to('.wipe', { yPercent: -100, duration: 0.85, ease: 'power4.inOut' }, '+=0.1')
      .add(() => {
        document.body.classList.remove('is-loading');
        lenis?.start();
        typeEyebrow();
      }, '<+=0.45')
      .to(split1.chars, { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.03 }, '<')
      .to(split2.chars, { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.03 }, '<+=0.22')
      .to('.hero__intro', { opacity: 1, y: 0, duration: 0.9 }, '<+=0.4')
      .to('.hero__cue', { opacity: 1, y: 0, duration: 0.9 }, '<+=0.1')
      .to('.nav', { opacity: 1, y: 0, duration: 0.8 }, '<')
      .set('.wipe', { display: 'none' });
  };

  /* ---------- Marquee: velocity-reactive infinite loop (spec 03) ---------- */
  const initMarquee = () => {
    const track = document.querySelector('.marquee__track');
    if (!track || reduced) return;
    const loop = gsap.to(track, { xPercent: -50, ease: 'none', duration: 22, repeat: -1 });
    let target = 1;
    ScrollTrigger.create({
      onUpdate(self) {
        const v = self.getVelocity();
        if (Math.abs(v) > 50) target = gsap.utils.clamp(-5, 5, v / 280);
      },
    });
    gsap.ticker.add(() => {
      const cur = loop.timeScale();
      loop.timeScale(cur + (target - cur) * 0.07);
      // decay back to base speed ±1, keeping the last direction
      target += ((target < 0 ? -1 : 1) - target) * 0.05;
    });
  };

  /* ---------- Work grid (spec 04) ---------- */
  const initWork = () => {
    if (reduced) return;
    gsap.set('.card', { clipPath: 'inset(100% 0% 0% 0%)', y: 80, opacity: 0 });
    ScrollTrigger.batch('.card', {
      start: 'top 88%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          clipPath: 'inset(0% 0% 0% 0%)',
          y: 0,
          opacity: 1,
          duration: 1.25,
          stagger: 0.12,
          ease: 'power3.out',
          overwrite: true,
        }),
    });

    mm.add('(min-width: 769px)', () => {
      // right column lags (data-speed 0.92 stagger-parallax)
      const lag = gsap.fromTo('.work__col--r', { y: 0 }, {
        y: 90,
        ease: 'none',
        scrollTrigger: { trigger: '.work__grid', start: 'top bottom', end: 'bottom top', scrub: true },
      });
      // giant letters drift inside covers
      const drifts = [];
      document.querySelectorAll('.card__letter').forEach((letter) => {
        drifts.push(gsap.fromTo(letter, { yPercent: 14 }, {
          yPercent: -14,
          ease: 'none',
          scrollTrigger: { trigger: letter.closest('.card'), start: 'top bottom', end: 'bottom top', scrub: true },
        }));
      });
      return () => { lag.kill(); drifts.forEach((d) => d.kill()); };
    });
  };

  /* ---------- About: pinned word-reveal scrub (spec 05) ---------- */
  const initAbout = () => {
    const statement = document.querySelector('.about__statement');
    if (!statement) return;
    if (reduced) return;
    const split = new SplitText(statement, { type: 'words' });
    gsap.set(split.words, { opacity: 0.15 });
    const hlWords = split.words.filter((w) => w.closest('.hl'));

    mm.add('(min-width: 769px)', () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: '.about', start: 'top top', end: '+=110%', pin: true, scrub: true },
      });
      tl.to(split.words, { opacity: 1, stagger: 0.05, ease: 'none', duration: 3 })
        .fromTo(hlWords, { scale: 1 }, { scale: 1.05, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.inOut' });
      return () => { tl.scrollTrigger?.kill(); tl.kill(); gsap.set(split.words, { opacity: 1 }); };
    });

    mm.add('(max-width: 768px)', () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 45%', scrub: true },
      });
      tl.to(split.words, { opacity: 1, stagger: 0.05, ease: 'none' });
      return () => { tl.scrollTrigger?.kill(); tl.kill(); gsap.set(split.words, { opacity: 1 }); };
    });
  };

  /* ---------- Stats: count-up + growing hairlines (spec 06) ---------- */
  const initStats = () => {
    const stats = gsap.utils.toArray('.stat');
    if (!stats.length) return;
    if (reduced) return;
    gsap.set('.stat__line', { scaleY: 0 });
    ScrollTrigger.create({
      trigger: '.stats',
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to('.stat__line', { scaleY: 1, duration: 1.1, stagger: 0.15, ease: 'power3.out' });
        stats.forEach((stat, i) => {
          const numEl = stat.querySelector('.stat__num');
          const targetVal = +numEl.dataset.count;
          const pad = +(numEl.dataset.pad || 1);
          const suffix = numEl.dataset.suffix || '';
          const obj = { v: 0 };
          gsap.to(obj, {
            v: targetVal,
            duration: 1.6,
            delay: i * 0.15,
            ease: 'expo.out',
            snap: { v: 1 },
            onUpdate: () => {
              numEl.textContent = String(Math.round(obj.v)).padStart(pad, '0') + suffix;
            },
          });
        });
      },
    });
  };

  /* ---------- Service rows: slide-in + image trail (spec 07) ---------- */
  const initServices = () => {
    if (!reduced) {
      gsap.set('.srow', { y: 60, opacity: 0 });
      ScrollTrigger.batch('.srow', {
        start: 'top 90%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'power3.out', overwrite: true }),
      });
    }

    if (finePointer && !reduced) {
      const trail = document.querySelector('.trail');
      gsap.set(trail, { scale: 0.85 });
      const tx = gsap.quickTo(trail, 'x', { duration: 0.5, ease: 'power3' });
      const ty = gsap.quickTo(trail, 'y', { duration: 0.5, ease: 'power3' });
      const tr = gsap.quickTo(trail, 'rotation', { duration: 0.6, ease: 'power3' });
      let lastX = 0;
      window.addEventListener('mousemove', (e) => {
        tx(e.clientX); ty(e.clientY);
        tr(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.35));
        lastX = e.clientX;
      });
      let trailOn = false;
      const hideTrail = () => {
        trailOn = false;
        gsap.to(trail, { opacity: 0, scale: 0.85, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      };
      document.querySelectorAll('.srow').forEach((row) => {
        row.addEventListener('mouseenter', () => {
          trailOn = true;
          trail.style.background = row.dataset.grad;
          gsap.to(trail, { opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
        });
        row.addEventListener('mouseleave', hideTrail);
      });
      // rows can leave the cursor via scrolling — mouseleave never fires then
      ScrollTrigger.create({
        onUpdate: () => { if (trailOn && !document.querySelector('.srow:hover')) hideTrail(); },
      });
    }
  };

  /* ---------- Footer: wordmark parallax + CTA reveal (spec 08) ---------- */
  const initFooter = () => {
    if (reduced) return;
    gsap.fromTo('.footer__word', { yPercent: 38 }, {
      yPercent: -8,
      ease: 'none',
      scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
    const lines = gsap.utils.toArray('.footer__cta-line, .footer__eyebrow, .pill');
    gsap.set(lines, { y: 50, opacity: 0 });
    ScrollTrigger.create({
      trigger: '.footer',
      start: 'top 70%',
      once: true,
      onEnter: () => gsap.to(lines, { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: 'power3.out' }),
    });
  };

  /* ---------- Boot (after fonts so SplitText measures correctly) ---------- */
  const boot = () => {
    runIntro();
    initMarquee();
    initWork();
    initAbout();
    initStats();
    initServices();
    initFooter();
    ScrollTrigger.refresh();
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
  } else {
    window.addEventListener('load', boot);
  }
})();
