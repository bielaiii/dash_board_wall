import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const clamp = (n) => Math.max(0, Math.min(100, n));
let lastCpu = null;
let lastNet = null;
let codexCache = { at: 0, data: null };
let gitCache = { at: 0, data: null };
let hostCpuCache = { at: 0, data: null, pending: null, disabledUntil: 0 };
const powershell = process.platform === 'win32' ? 'powershell.exe' : '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

async function runPowerShell(file, timeout) {
  const script = fs.readFileSync(path.join(root, file), 'utf8');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const { stdout } = await exec(powershell, ['-NoProfile', '-EncodedCommand', encoded], { timeout, maxBuffer: 200000 });
  return stdout.trim();
}

const hostTopologyPromise = fs.existsSync(powershell) ? runPowerShell('windows-topology.ps1', 5000).then(output => {
  const groups = output.split(';').map((record, index) => {
    const [efficiency, logicalText] = record.split(':');
    const logical = logicalText?.split(',').map(Number).filter(Number.isInteger) || [];
    return { index: index + 1, logical, type: Number(efficiency) > 0 ? 'P' : 'E' };
  }).filter(group => group.logical.length);
  const logicalCount = groups.reduce((sum, group) => sum + group.logical.length, 0);
  return groups.length > 0 && logicalCount === os.cpus().length ? groups : null;
}).catch(() => null) : Promise.resolve(null);

async function hostCpu() {
  const groups = await hostTopologyPromise;
  if (!groups || Date.now() < hostCpuCache.disabledUntil) return cpu();
  if (hostCpuCache.data && Date.now() - hostCpuCache.at < 2500) return hostCpuCache.data;
  if (hostCpuCache.pending) return hostCpuCache.pending;
  hostCpuCache.pending = (async () => {
    try {
      const output = await runPowerShell('windows-cpu.ps1', 5500);
      const logical = new Map();
      for (const line of output.split(/\r?\n/)) {
        const match = line.trim().match(/^\d+,(\d+):([\d.]+)$/);
        if (match) logical.set(Number(match[1]), clamp(Number(match[2])));
      }
      if (logical.size < os.cpus().length) throw new Error('incomplete host CPU sample');
      const cores = groups.map(group => {
        const values = group.logical.map(index => logical.get(index)).filter(Number.isFinite);
        const percent = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
        return { index: group.index, threads: group.logical.length, type: group.type, percent };
      });
      const values = [...logical.values()];
      const data = { percent: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length), cores, physicalCount: cores.length, logicalCount: logical.size, topologySource: 'windows-host', model: os.cpus()[0]?.model || null };
      hostCpuCache = { at: Date.now(), data, pending: null, disabledUntil: 0 };
      return data;
    } catch {
      hostCpuCache.disabledUntil = Date.now() + 60000;
      return cpu();
    } finally { hostCpuCache.pending = null; }
  })();
  return hostCpuCache.pending;
}

function cpuTopology() {
  const groups = new Map();
  const count = os.cpus().length;
  let physical = true;
  for (let logical = 0; logical < count; logical++) {
    let packageId, coreId;
    try {
      const directory = `/sys/devices/system/cpu/cpu${logical}/topology`;
      packageId = Number(fs.readFileSync(`${directory}/physical_package_id`, 'utf8').trim());
      coreId = Number(fs.readFileSync(`${directory}/core_id`, 'utf8').trim());
      if (!Number.isInteger(packageId) || !Number.isInteger(coreId)) throw new Error('bad topology');
    } catch {
      physical = false;
      packageId = 0;
      coreId = logical;
    }
    const key = `${packageId}:${coreId}`;
    if (!groups.has(key)) groups.set(key, { packageId, coreId, logical: [] });
    groups.get(key).logical.push(logical);
  }
  return { physical, groups: [...groups.values()].sort((a, b) => a.packageId - b.packageId || a.coreId - b.coreId) };
}
const topology = cpuTopology();

function cpu() {
  const samples = new Map();
  for (const line of fs.readFileSync('/proc/stat', 'utf8').split('\n')) {
    const match = line.match(/^(cpu\d*?)\s+(.+)$/);
    if (!match) continue;
    const values = match[2].trim().split(/\s+/).map(Number);
    samples.set(match[1], { idle: values[3] + (values[4] || 0), total: values.reduce((a, b) => a + b, 0) });
  }
  const previous = lastCpu;
  lastCpu = samples;
  const delta = key => {
    const current = samples.get(key), old = previous?.get(key);
    return current && old ? { idle: current.idle - old.idle, total: current.total - old.total } : null;
  };
  const whole = delta('cpu');
  const cores = topology.groups.map((group, index) => {
    const combined = group.logical.map(logical => delta(`cpu${logical}`)).filter(Boolean);
    const idle = combined.reduce((sum, item) => sum + item.idle, 0);
    const total = combined.reduce((sum, item) => sum + item.total, 0);
    return { index: index + 1, packageId: group.packageId, coreId: group.coreId, threads: group.logical.length, percent: total > 0 ? clamp(Math.round((1 - idle / total) * 100)) : null };
  });
  return { percent: whole && whole.total > 0 ? clamp(Math.round((1 - whole.idle / whole.total) * 100)) : null, cores, logicalCount: os.cpus().length, physicalCount: cores.length, topologySource: topology.physical ? 'linux-topology' : 'logical-fallback', model: os.cpus()[0]?.model || null };
}

function memory() {
  const values = Object.fromEntries(fs.readFileSync('/proc/meminfo', 'utf8').split('\n').filter(Boolean).map(line => {
    const match = line.match(/^(\w+):\s+(\d+)/);
    return match ? [match[1], Number(match[2]) * 1024] : [];
  }).filter(x => x.length));
  const total = values.MemTotal || 0;
  const used = total - (values.MemAvailable || 0);
  return { used, total, percent: total ? clamp(Math.round(used / total * 100)) : null };
}

function network() {
  const now = Date.now();
  const lines = fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2);
  let rx = 0, tx = 0;
  for (const line of lines) {
    const [name, values] = line.split(':');
    if (!values || name.trim() === 'lo') continue;
    const parts = values.trim().split(/\s+/).map(Number);
    rx += parts[0] || 0;
    tx += parts[8] || 0;
  }
  const previous = lastNet;
  lastNet = { rx, tx, now };
  const seconds = previous ? Math.max((now - previous.now) / 1000, 0.1) : 1;
  return { down: previous ? Math.max(0, (rx - previous.rx) / seconds) : null, up: previous ? Math.max(0, (tx - previous.tx) / seconds) : null };
}

async function gpu() {
  try {
    const fields = 'name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw,power.limit,clocks.current.graphics';
    const { stdout } = await exec('nvidia-smi', [`--query-gpu=${fields}`, '--format=csv,noheader,nounits'], { timeout: 1800 });
    const [name, utilization, memoryUtilization, used, total, temperature, powerDraw, powerLimit, graphicsClock] = stdout.trim().split('\n')[0].split(',').map(x => x.trim());
    const number = value => value && value.toLowerCase() !== 'n/a' && Number.isFinite(Number(value)) ? Number(value) : null;
    return { name, percent: number(utilization), memoryPercent: number(memoryUtilization), memoryUsed: number(used) == null ? null : number(used) * 1048576, memoryTotal: number(total) == null ? null : number(total) * 1048576, temperature: number(temperature), powerDraw: number(powerDraw), powerLimit: number(powerLimit), graphicsClock: number(graphicsClock) };
  } catch {
    for (const entry of fs.existsSync('/sys/class/drm') ? fs.readdirSync('/sys/class/drm') : []) {
      if (!/^card\d+$/.test(entry)) continue;
      const device = `/sys/class/drm/${entry}/device`;
      try {
        const percent = Number(fs.readFileSync(`${device}/gpu_busy_percent`, 'utf8').trim());
        return { name: entry.toUpperCase(), percent: clamp(percent), memoryPercent: null, memoryUsed: null, memoryTotal: null, temperature: null, powerDraw: null, powerLimit: null, graphicsClock: null };
      } catch {}
    }
    return { name: 'GPU 数据不可用', percent: null, memoryPercent: null, memoryUsed: null, memoryTotal: null, temperature: null, powerDraw: null, powerLimit: null, graphicsClock: null };
  }
}

function sessionFiles() {
  const base = path.join(os.homedir(), '.codex', 'sessions');
  const now = new Date();
  const months = [now, new Date(now.getFullYear(), now.getMonth() - 1, 1)];
  const files = [];
  for (const date of months) {
    const month = path.join(base, String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, '0'));
    if (!fs.existsSync(month)) continue;
    for (const day of fs.readdirSync(month)) {
      const dir = path.join(month, day);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const name of fs.readdirSync(dir)) if (name.endsWith('.jsonl')) {
        const file = path.join(dir, name);
        files.push({ file, mtime: fs.statSync(file).mtimeMs });
      }
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime).slice(0, 14);
}

function codex() {
  if (Date.now() - codexCache.at < 25000) return codexCache.data;
  let found = null;
  for (const { file } of sessionFiles()) {
    const size = fs.statSync(file).size;
    const length = Math.min(size, 1048576);
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, buffer, 0, length, size - length);
    fs.closeSync(fd);
    const lines = buffer.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('rate_limits')) continue;
      try {
        const record = JSON.parse(lines[i]);
        const limits = record.payload?.info?.rate_limits || record.payload?.rate_limits;
        if (!limits?.primary || !limits?.secondary) continue;
        const timestamp = new Date(record.timestamp).getTime();
        if (!found || timestamp > found.timestamp) found = {
          timestamp,
          primary: limits.primary,
          secondary: limits.secondary,
          credits: { balance: limits.credits?.balance != null && Number.isFinite(Number(limits.credits.balance)) ? Number(limits.credits.balance) : null, hasCredits: limits.credits?.has_credits ?? null, unlimited: limits.credits?.unlimited ?? null },
          plan: limits.plan_type || null
        };
        break;
      } catch {}
    }
  }
  codexCache = { at: Date.now(), data: found };
  return found;
}

function gitDirectories() {
  if (process.env.DASHBOARD_GIT_DIRS) return process.env.DASHBOARD_GIT_DIRS.split(path.delimiter).filter(Boolean).map(x => path.resolve(x));
  const home = os.homedir();
  const dirs = [];
  for (const name of fs.readdirSync(home)) {
    if (name.startsWith('.')) continue;
    const full = path.join(home, name);
    try {
      if (!fs.statSync(full).isDirectory()) continue;
      if (fs.existsSync(path.join(full, '.git'))) dirs.push(full);
      else if (name === 'dashboard') for (const child of fs.readdirSync(full)) {
        const nested = path.join(full, child);
        if (fs.existsSync(path.join(nested, '.git'))) dirs.push(nested);
      }
    } catch {}
  }
  return dirs.slice(0, 30);
}

async function git() {
  if (Date.now() - gitCache.at < 300000) return gitCache.data;
  const dirs = gitDirectories();
  const days = Object.create(null);
  let last = null;
  let author = process.env.DASHBOARD_GIT_AUTHOR?.trim().toLowerCase();
  if (!author) {
    try { author = (await exec('git', ['config', '--global', 'user.email'], { timeout: 1500 })).stdout.trim().toLowerCase(); } catch {}
  }
  await Promise.all(dirs.map(async dir => {
    try {
      const args = ['-C', dir, 'log', '--all', '--since=1 year ago', '--format=%as%x09%ae%x09%at', '--max-count=2500'];
      const { stdout } = await exec('git', args, { timeout: 5000, maxBuffer: 2_000_000 });
      for (const line of stdout.split('\n')) {
        const [day, email, seconds] = line.split('\t');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || (author && email?.toLowerCase() !== author)) continue;
        days[day] = (days[day] || 0) + 1;
        const time = Number(seconds) * 1000;
        if (time && (!last || time > last)) last = time;
      }
    } catch {}
  }));
  const data = { days, repos: dirs.length, total: Object.values(days).reduce((a, b) => a + b, 0), last, authorFiltered: Boolean(author) };
  gitCache = { at: Date.now(), data };
  return data;
}

async function status() {
  const [cpuData, gpuData, gitData] = await Promise.all([hostCpu(), gpu(), git()]);
  return { timestamp: Date.now(), hostname: os.hostname(), cpu: cpuData, gpu: gpuData, memory: memory(), network: network(), git: gitData, codex: codex() };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/status') {
    try {
      const data = await status();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '无法读取本机状态' }));
      console.error(error);
    }
    return;
  }
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!['index.html', 'styles.css', 'app.js'].includes(file)) { res.writeHead(404); res.end(); return; }
  try {
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(path.join(root, file)).pipe(res);
  } catch { res.writeHead(404); res.end(); }
});
server.listen(port, host, () => console.log(`Pulse Dashboard → http://${host}:${port}`));
