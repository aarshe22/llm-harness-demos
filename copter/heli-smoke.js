// CDP smoke test for heli.html — logic-only (renderer stubbed, no GPU)
const { spawn } = require('child_process');
const PORT = 20000 + ((Math.random() * 20000) | 0);
const errors = [];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const STUB = `
(() => {
  let _T;
  Object.defineProperty(window, 'THREE', {
    configurable: true,
    get(){ return _T; },
    set(v){
      _T = v;
      v.WebGLRenderer = function(){
        const el = document.createElement('canvas');
        return {
          domElement: el,
          capabilities:{ getMaxAnisotropy: () => 1 },
          shadowMap:{}, info:{ render:{} },
          setPixelRatio(){}, getPixelRatio(){ return 1; }, setSize(){},
          render(){}, setRenderTarget(){}, setClearColor(){}, clear(){},
        };
      };
    }
  });
})();
`;

async function main() {
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--no-sandbox', '--mute-audio',
    '--remote-allow-origins=*',
    '--user-data-dir=' + require('os').tmpdir() + '/heli-smoke-profile-' + PORT,
    '--window-size=390,700',
    `--remote-debugging-port=${PORT}`,
    '--allow-file-access-from-files',
    'about:blank',
  ], { stdio: 'ignore', detached: true });
  const killAll = () => { try { process.kill(-chrome.pid, 'SIGKILL'); } catch (e) {} };
  process.on('exit', killAll);

  let targets = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl && t.url === 'about:blank');
      if (page) { targets = page; break; }
    } catch (e) {}
  }
  if (!targets) { console.log('FAIL: no devtools target'); process.exit(1); }
  log('devtools target on port', PORT);

  const ws = new WebSocket(targets.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, resolve);
      setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('CDP timeout ' + method)); } }, 60000);
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
  }
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception ? d.exception.description : d.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const txt = msg.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ');
      if (msg.params.type === 'error') errors.push('console: ' + txt);
      else if (/boot/.test(txt)) log('PAGE:', txt);
    }
  };
  await Promise.race([
    new Promise(r => { ws.onopen = r; }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('ws connect timeout')), 15000)),
  ]);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Page.navigate', { url: 'file:///Users/localuser/qtoday/heli.html?low=1&nopaint=1' });
  log('navigated');

  async function eval_(expr) {
    const r = await send('Runtime.evaluate', { expression: expr });
    if (r.result.exceptionDetails) errors.push('eval: ' + JSON.stringify((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text));
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  // wait for world boot
  for (let i = 0; i < 60; i++) {
    const f = await eval_('window.__frames||0');
    if (f > 30) break;
    await new Promise(r => setTimeout(r, 500));
  }
  log('frames after boot:', await eval_('window.__frames|0'));

  async function key(code) {
    await eval_(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'${code}'}))`);
    await new Promise(r => setTimeout(r, 150));
    await eval_(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'${code}'}))`);
  }
  log('--- nuke test');
  await key('Digit2'); await key('KeyF');
  await new Promise(r => setTimeout(r, 4000));
  log('--- respawn + beam test');
  await key('KeyR');
  await key('Digit3');
  await eval_(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'}))`);
  await new Promise(r => setTimeout(r, 1500));
  await eval_(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF'}))`);
  log('--- flir toggle');
  await key('KeyT');
  await new Promise(r => setTimeout(r, 600));
  await key('KeyT');
  log('--- jdam test');
  await key('Digit1');
  for (let i = 0; i < 3; i++) { await key('KeyF'); await new Promise(r => setTimeout(r, 700)); }
  log('--- weather sweep');
  for (let w = 1; w <= 4; w++) {
    await eval_(`document.getElementById('selWx').value='${w}'; document.getElementById('selWx').dispatchEvent(new Event('change'))`);
    await new Promise(r => setTimeout(r, 250));
  }
  log('--- time scrub night/day');
  await eval_(`var s=document.getElementById('rngTime'); s.value='300'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change'))`);
  await new Promise(r => setTimeout(r, 300));
  await eval_(`s=document.getElementById('rngTime'); s.value='1300'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change'))`);
  await new Promise(r => setTimeout(r, 300));
  log('--- regen new world');
  await eval_(`document.getElementById('bNew').click()`);
  await new Promise(r => setTimeout(r, 2500));
  log('--- hover + view + sound-on + respawn');
  await eval_(`document.getElementById('bHover').click()`);
  await eval_(`document.getElementById('bView').click()`);
  await eval_(`document.getElementById('bSnd').click()`);
  await key('KeyR');
  await new Promise(r => setTimeout(r, 500));
  log('FINAL frames:', await eval_('window.__frames|0'));
  console.log('ERRORS(' + errors.length + '):');
  errors.slice(0, 20).forEach(e => console.log('  ' + String(e).split('\n')[0]));
  killAll();
  process.exit(errors.length ? 2 : 0);
}
main().catch(e => { console.log('HARNESS FAIL', e.message); process.exit(1); });
