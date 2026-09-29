#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const mobileDir = path.join(rootDir, 'mobile');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Ensure dependencies are installed if missing
const backendNodeModules = path.join(backendDir, 'node_modules');
const mobileNodeModules = path.join(mobileDir, 'node_modules');

if (!fs.existsSync(backendNodeModules) || !fs.existsSync(mobileNodeModules)) {
  console.log('\x1b[33m%s\x1b[0m', '📦 Dependencies not found. Installing packages for backend and mobile...');
  const installResult = spawnSync(npmCmd, ['run', 'setup'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows,
  });
  if (installResult.status !== 0) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Failed to install dependencies. Please run "npm run setup" manually.');
    process.exit(installResult.status || 1);
  }
}

const args = process.argv.slice(2);

console.log('\x1b[32m%s\x1b[0m', '🚀 Starting Pharm-LIT development environment...');
console.log('   📡 Backend API  : http://localhost:4000');
console.log('   📱 Mobile / Web : Expo dev server');
console.log('   💡 Press Ctrl+C at any time to stop all services.\n');

// Prefix stream helper
function pipeWithPrefix(stream, prefix, color, target = process.stdout) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      target.write(`${color}${prefix}\x1b[0m ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer.length > 0) {
      target.write(`${color}${prefix}\x1b[0m ${buffer}\n`);
    }
  });
}

// Start backend API
const apiProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: backendDir,
  shell: isWindows,
  env: { ...process.env, FORCE_COLOR: '1' },
});

pipeWithPrefix(apiProcess.stdout, '[api]', '\x1b[36m', process.stdout);
pipeWithPrefix(apiProcess.stderr, '[api]', '\x1b[31m', process.stderr);

// Start mobile app (Expo)
const mobileArgs = ['start', ...(args.length > 0 ? ['--', ...args] : [])];
const mobileProcess = spawn(npmCmd, mobileArgs, {
  cwd: mobileDir,
  shell: isWindows,
  stdio: [process.stdin.isTTY ? 'inherit' : 'ignore', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '1' },
});

pipeWithPrefix(mobileProcess.stdout, '[app]', '\x1b[35m', process.stdout);
pipeWithPrefix(mobileProcess.stderr, '[app]', '\x1b[31m', process.stderr);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n\x1b[33m%s\x1b[0m', '🛑 Shutting down development servers...');

  const killChild = (child) => {
    if (!child || child.killed) return;
    if (isWindows && child.pid) {
      try {
        spawnSync('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
      } catch {
        try { child.kill(); } catch { /* ignore */ }
      }
    } else {
      try {
        child.kill('SIGINT');
      } catch {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }
    }
  };

  killChild(apiProcess);
  killChild(mobileProcess);

  setTimeout(() => {
    killChild(apiProcess);
    killChild(mobileProcess);
    process.exit(code);
  }, 1000);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

apiProcess.on('exit', (code) => {
  if (!shuttingDown && code !== 0 && code !== null) {
    console.error(`\x1b[31m[api] exited with code ${code}\x1b[0m`);
  }
});

mobileProcess.on('exit', (code) => {
  if (!shuttingDown && code !== 0 && code !== null) {
    console.error(`\x1b[35m[app] exited with code ${code}\x1b[0m`);
  }
});
