import { itemIconDataURL, ITEM_LABELS } from './sprites.js';

export class UI {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      inv: document.getElementById('inventory'),
      dlg: document.getElementById('dialogue'),
      name: document.getElementById('dlg-name'),
      text: document.getElementById('dlg-text'),
      choices: document.getElementById('dlg-choices'),
      label: document.getElementById('hotspot-label'),
      toastWrap: document.getElementById('toast-wrap'),
      fade: document.getElementById('fade'),
      dance: document.getElementById('dance'),
      danceMarker: document.getElementById('dance-marker'),
      danceHits: document.getElementById('dance-hits'),
      danceMisses: document.getElementById('dance-misses'),
      intro: document.getElementById('intro'),
      chapter: document.getElementById('chapter'),
      chapTitle: document.getElementById('chap-title'),
      chapBlurb: document.getElementById('chap-blurb'),
      chapNext: document.getElementById('chap-next'),
      victory: document.getElementById('victory'),
      victoryText: document.getElementById('victory-text'),
      charisma: document.getElementById('charisma'),
      charismaVal: document.getElementById('charisma-val')
    };
    this.typing = null;
    this.isOpen = false;
    this.danceActive = false;
    this.items = [];
  }

  showHUD(on) {
    this.el.hud.classList.toggle('hidden', !on);
    this.el.inv.classList.toggle('hidden', !on);
  }

  setCursorLabel(text, x, y) {
    if (!text) {
      this.el.label.style.display = 'none';
      return;
    }
    this.el.label.textContent = text;
    this.el.label.style.display = 'block';
    this.el.label.style.left = (x + 18) + 'px';
    this.el.label.style.top = (y + 14) + 'px';
  }

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.el.toastWrap.appendChild(t);
    setTimeout(() => t.remove(), 3100);
  }

  fadeSwitch(cb) {
    this.el.fade.classList.add('on');
    setTimeout(() => {
      cb();
      setTimeout(() => this.el.fade.classList.remove('on'), 60);
    }, 340);
  }

  say(name, text, onDone) {
    this._open(name, text, [], onDone);
  }

  dialog(name, text, options, onSelect) {
    this._open(name, text, options, null, onSelect);
  }

  _open(name, text, options, onDone, onSelect) {
    this.isOpen = true;
    this.el.name.textContent = name;
    this.el.dlg.classList.add('open');
    this.el.choices.innerHTML = '';
    this._type(text, () => {
      if (onDone && options.length === 0) {
        const btn = document.createElement('button');
        btn.innerHTML = '&#9656; CONTINUE';
        btn.onclick = () => { this.close(); onDone(); };
        this.el.choices.appendChild(btn);
      }
      for (const opt of options) {
        const btn = document.createElement('button');
        btn.innerHTML = '&#9656; ' + opt.label;
        if (opt.uses) {
          btn.innerHTML += ` <span class="item-tag">[uses ${ITEM_LABELS[opt.uses]}]</span>`;
        }
        btn.onclick = () => { onSelect(opt); };
        this.el.choices.appendChild(btn);
      }
    });
  }

  _type(text, done) {
    clearInterval(this.typing);
    this.el.text.textContent = '';
    let i = 0;
    this.typing = setInterval(() => {
      i += 2;
      this.el.text.textContent = text.slice(0, i);
      if (this.onBlip) this.onBlip();
      if (i >= text.length) {
        clearInterval(this.typing);
        this.el.text.textContent = text;
        if (done) done();
      }
    }, 16);
  }

  close() {
    clearInterval(this.typing);
    this.el.dlg.classList.remove('open');
    this.isOpen = false;
  }

  addItem(id) {
    if (this.items.includes(id)) return;
    this.items.push(id);
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    slot.title = ITEM_LABELS[id] || id;
    const img = document.createElement('img');
    img.src = itemIconDataURL(id);
    slot.appendChild(img);
    this.el.inv.appendChild(slot);
    this.toast('ACQUIRED: ' + (ITEM_LABELS[id] || id));
  }

  hasItem(id) {
    return this.items.includes(id);
  }

  removeItem(id) {
    this.items = this.items.filter((x) => x !== id);
    const slots = this.el.inv.querySelectorAll('.inv-slot');
    for (const s of slots) {
      if ((s.title || '').toUpperCase() === (ITEM_LABELS[id] || '')) {
        s.remove();
        break;
      }
    }
  }

  setCharisma(n) {
    this.el.charismaVal.textContent = n;
    this.el.charisma.classList.remove('pop');
    void this.el.charisma.offsetWidth;
    this.el.charisma.classList.add('pop');
  }

  showIntro(onStart) {
    document.getElementById('start-btn').addEventListener('click', () => {
      this.el.intro.classList.add('hidden');
      onStart();
    });
  }

  showVictory(text, onRestart) {
    this.el.victoryText.textContent = text;
    this.el.victory.classList.remove('hidden');
    document.getElementById('again-btn').onclick = () => location.reload();
  }

  showInterstitial(title, blurb, nextLabel, cb) {
    this.el.chapTitle.textContent = title;
    this.el.chapBlurb.textContent = blurb;
    this.el.chapNext.textContent = nextLabel;
    this.el.chapter.classList.remove('hidden');
    this.el.chapNext.onclick = () => {
      this.el.chapter.classList.add('hidden');
      cb();
    };
  }

  startDance(opts, onWin, onLose) {
    if (typeof opts === 'function') { onWin = opts; opts = {}; }
    this.danceActive = true;
    this.el.dance.classList.add('open');
    let hits = 0;
    let misses = 0;
    let raf = 0;
    let last = performance.now();
    const speed = (opts && opts.speed) || 0.9;
    const zoneMin = 0.42;
    const zoneMax = 0.58;
    let dir = 1;
    let pos = 0;
    let locked = false;

    const render = () => {
      this.el.danceHits.textContent = hits + '/3';
      this.el.danceMisses.textContent = misses + '/3';
    };

    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!locked) {
        pos += dir * speed * dt;
        if (pos > 1) { pos = 1; dir = -1; }
        if (pos < 0) { pos = 0; dir = 1; }
        this.el.danceMarker.style.left = (pos * 100) + '%';
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onKey = (e) => {
      if (e.code !== 'Space' || locked) return;
      e.preventDefault();
      locked = true;
      if (this.onHit) this.onHit();
      if (pos >= zoneMin && pos <= zoneMax) {
        hits++;
        this.el.danceMarker.style.background = '#1ec9ff';
      } else {
        misses++;
        this.el.danceMarker.style.background = '#ff5f5f';
        if (this.onMiss) this.onMiss();
      }
      render();
      setTimeout(() => {
        this.el.danceMarker.style.background = '#ff4fd8';
        locked = false;
        if (hits >= 3) finish(onWin);
        else if (misses >= 3) finish(onLose);
      }, 260);
    };

    const finish = (cb) => {
      this.danceActive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      this.el.dance.classList.remove('open');
      cb();
    };

    window.addEventListener('keydown', onKey);
    render();
  }
}
