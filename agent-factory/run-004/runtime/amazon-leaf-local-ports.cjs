'use strict';

const fs = require('node:fs');
const path = require('node:path');

function assertLoopback(url) {
  const u = new URL(url);
  const hosts = new Set(['127.0.0.1','localhost','::1']);
  if (u.protocol !== 'http:' || !hosts.has(u.hostname) || u.username || u.password || u.search || u.hash) {
    throw new Error('LOOPBACK_WORK_CONTROL_REQUIRED');
  }
  return u.toString().replace(/\/$/, '');
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.next-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temp, file);
}

function makeLocalPorts({ workControlBase='http://127.0.0.1:8787', stateFile, fetchImpl=fetch }) {
  const base = assertLoopback(workControlBase);
  if (!stateFile || !path.isAbsolute(stateFile)) throw new Error('ABSOLUTE_STATE_FILE_REQUIRED');
  const lockFile = `${stateFile}.lock`;

  async function request(url, body) {
    const response = await fetchImpl(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { accept:'application/json', ...(body === undefined ? {} : {'content-type':'application/json'}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect:'error',
      signal:AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const e = new Error(`HTTP_${response.status}`);
      e.status = response.status;
      throw e;
    }
    return response.json();
  }

  return {
    workControl: {
      dispatch: body => request(`${base}/api/v1/commands`, body),
      read: id => request(`${base}/api/v1/commands/${encodeURIComponent(id)}`),
    },
    store: {
      async read() {
        try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
        catch (error) {
          if (error.code === 'ENOENT') return null;
          throw error;
        }
      },
      async compareAndSet(expected, next) {
        fs.mkdirSync(path.dirname(stateFile), { recursive:true });
        let fd;
        try {
          fd = fs.openSync(lockFile, 'wx', 0o600);
          let current = null;
          try { current = JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
          const version = current?.version || 0;
          if (version !== expected) throw new Error('CHECKPOINT_CONFLICT');
          atomicWrite(stateFile, next);
        } finally {
          if (fd !== undefined) fs.closeSync(fd);
          try { fs.unlinkSync(lockFile); } catch {}
        }
        return next;
      },
    },
  };
}

module.exports={assertLoopback,makeLocalPorts};
