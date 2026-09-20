// Paint test: render real WebGL frames + FLIR pass under SwiftShader
const { spawn } = require('child_process');
const PORT = 20000 + ((Math.random() * 20000) | 0);
const errors = [];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--no-sandbox', '--mute-audio',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-allow-origins=*',
    '--user-data-dir=' + require('os').tmpdir() + '/heli-paint-profile-' + PORT,
    '--window-size=390,700',
    `--remote-debugging-port=${PORT}`,
    '--allow-file-access-from-files',
    'file:///Users/localuser/qtoday/heli.html?low=1&seed='+process.env.SEED,
  ], { stdio: 'ignore', detached: true });
  const killAll = () => { try { process.kill(-chrome.pid, 'SIGKILL'); } catch (e) {} };
  process.on('exit', killAll);

  let targets = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl && t.url.indexOf('heli.html') >= 0);
      if (page) { targets = page; break; }
    } catch (e) {}
  }
  if (!targets) { console.log('FAIL no target'); process.exit(1); }

  const ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  const send = (m, p) => new Promise(res => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method: m, params: p || {} })); });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Debugger.paused' && stacks < 1) {
      stacks++;
      console.log('--- UNCAUGHT:', msg.params.reason);
      msg.params.callFrames.slice(0,10).forEach(f =>
        console.log('   at', f.functionName || '(anon)', (f.url||'').split('/').pop(), f.location.lineNumber+1));
      send('Debugger.resume');
    } else if (msg.method === 'Debugger.paused') {
      send('Debugger.resume');
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception ? d.exception.description : d.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const txt = msg.params.args.map(a => a.value ?? a.description).join(' ');
      if (msg.params.type === 'error') errors.push('console: ' + txt);
      else if (/boot/.test(txt)) log('PAGE:', txt);
    }
  };
  await send('Runtime.enable');
  await send('Debugger.enable');
  await send('Debugger.setPauseOnExceptions', {state:'uncaught'});
  let stacks=0;
  const eval_ = async e => { const r = await send('Runtime.evaluate', { expression: e }); return r.result && r.result.result ? r.result.result.value : undefined; };

  log('waiting for painted frames (SwiftShader, be patient)...');
  let painted = 0;
  for (let i = 0; i < 40; i++) {
    painted = await eval_('window.__frames|0');
    if (painted > 3) break;
    await new Promise(r => setTimeout(r, 3000));
  }
  log('painted frames:', painted);
  log('toggling FLIR render pass...');
  await eval_(`window.__scene.traverse(o=>{o.onBeforeRender=()=>{window.__lastDraw=(o.constructor.name)+' m='+(o.material&&o.material.type||'?')+(o.count!==undefined?' cnt='+o.count:'')+(o.geometry&&o.geometry.attributes?Object.keys(o.geometry.attributes).join(','):'');};}); 'hooked'`);
  await eval_(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyT'}))`);
  await eval_(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyT'}))`);
  let f2 = 0;
  for (let i = 0; i < 40; i++) {
    f2 = await eval_('window.__frames|0');
    if (f2 > painted + 2) break;
    await new Promise(r => setTimeout(r, 3000));
  }
  log('flir frames:', f2);
  log('culprit draw was:', await eval_('window.__lastDraw'));
  console.log('ERRORS(' + errors.length + '):');
  for (const e of new Set(errors)) console.log('  ' + String(e).split('\n')[0]);
  killAll();
  process.exit(errors.length ? 2 : 0);
}
main().catch(e => { console.log('FAIL', e.message); process.exit(1); });
