#!/usr/bin/env node
// Local ports are explicit. Never search for another port or kill its owner.
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { dirname, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'local-web.json'), 'utf8'));
const mode = process.argv[2] || 'dev';
if (process.argv.length > 3 || (mode !== 'status' && !config.modes[mode])) {
  console.error(`Usage: node scripts/local-web.mjs ${[...Object.keys(config.modes), 'status'].join('|')} (no port overrides)`);
  process.exit(2);
}
if (mode === 'status') {
  for (const [name, spec] of Object.entries(config.modes)) {
    console.log(`${name}: ${spec.url || spec.ports.join(', ')}`);
    for (const port of spec.ports) {
      const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding:'utf8'});
      console.log(result.stdout?.trim() || (result.error ? result.error.message : `  :${port} 未监听`));
    }
  }
  process.exit(0);
}
const spec = config.modes[mode];
async function check(port, host) {
  await new Promise((ok, fail) => {
    const probe = net.createServer();
    probe.once('error', err => {
      if (host === '::' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(err.code)) ok();
      else fail(err);
    });
    probe.listen({port, host, exclusive:true, ...(host === '::' ? {ipv6Only:true} : {})}, () => probe.close(ok));
  });
}
try {
  for (const port of spec.ports) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid fixed port: ${port}`);
    // macOS can allow wildcard/specific-address binds simultaneously. Check all listeners too.
    const owners = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding:'utf8'});
    if (owners.error) throw owners.error;
    if (owners.stdout.trim()) throw new Error(`:${port} already listening (PID ${owners.stdout.trim().split('\n').join(', ')})`);
    for (const host of ['0.0.0.0', '::']) await check(port, host);
  }
} catch (err) {
  console.error(`[${config.project}/${mode}] 固定端口不可用：${err.message}`);
  console.error('不会递增端口，也不会终止其他进程。用 scripts/web.sh status 查占用；停止原服务后使用同一命令重启。');
  process.exit(1);
}
const paths = [dirname(process.execPath)];
for (let p = root;; p = dirname(p)) {
  paths.push(resolve(p, 'node_modules/.bin'));
  if (p === dirname(p)) break;
}
console.log(`[${config.project}/${mode}] ${spec.url || spec.ports.join(', ')}`);
const child = spawn(spec.command, {
  cwd: root, shell:true, stdio:'inherit', detached:process.platform !== 'win32',
  env:{...process.env, ...spec.env, PATH:paths.join(delimiter)+delimiter+process.env.PATH},
});
function stop(signal) {
  try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); } catch {}
}
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => stop(signal));
child.on('error', err => { console.error(err.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { stop('SIGTERM'); process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
