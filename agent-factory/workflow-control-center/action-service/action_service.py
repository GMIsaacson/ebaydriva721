#!/usr/bin/env python3
import json
import os
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BIND = '0.0.0.0'
PORT = 8791
N8N = 'agent-factory-n8n-nonprod-n8n-1'
PG = 'agent-factory-n8n-nonprod-postgres-1'
ALLOWED = {
    'ACQ001FACTORYDEMO',
    'CI001HEARTBEATV1',
    'DEMO10SCONTROLLED',
    'EMAILINTELV1',
    'OPP011LIVEWATCH003',
    'SOURCEMARGINACQDISPATCHG6',
    'SMEBAYLEAFCENSUS259340',
}
SPECIAL = {'DEMO10SCONTROLLED', 'EMAILINTELV1'}
TOKEN = os.environ.get('CONTROL_TOKEN','').strip()
LOCK = threading.Lock()

def run(args, timeout=90):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if p.returncode != 0:
        detail = (p.stderr or p.stdout or 'command failed').strip()[-1400:]
        raise RuntimeError(detail)
    return (p.stdout or '').strip()

def published_state(wid):
    sql = f"SELECT active FROM workflow_entity WHERE id='{wid}';"
    out = run(['docker','exec',PG,'psql','-U','n8n','-d','n8n','-Atqc',sql], timeout=15)
    return out.strip().lower() == 't'

def lifecycle(wid, publish):
    cmd = 'publish:workflow' if publish else 'unpublish:workflow'
    run(['docker','exec',N8N,'n8n',cmd,f'--id={wid}'], timeout=45)

def restart_n8n():
    run(['docker','restart','-t','5',N8N], timeout=90)
    deadline = time.time() + 90
    while time.time() < deadline:
        try:
            st = run(['docker','inspect','--format','{{.State.Health.Status}}',N8N], timeout=8).strip()
            if st == 'healthy':
                return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('n8n restarted but did not become healthy within 90 seconds')

def post_json(url, payload):
    raw = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=raw, method='POST', headers={
        'Content-Type':'application/json', 'Accept':'application/json'
    })
    with urllib.request.urlopen(req, timeout=12) as r:
        body = r.read(200000).decode('utf-8', 'replace')
        if r.status >= 300:
            raise RuntimeError(f'control endpoint HTTP {r.status}')
        try: return json.loads(body) if body else {}
        except Exception: return {'raw': body[:1200]}

def set_internal_enabled(wid, enabled):
    if wid not in SPECIAL:
        return None
    deadline = time.time() + 30
    last = None
    while time.time() < deadline:
        try:
            if wid == 'DEMO10SCONTROLLED':
                return post_json('http://agent-factory-n8n-nonprod-n8n-1:5678/webhook/demo-10s-control', {'enabled': bool(enabled)})
            if wid == 'EMAILINTELV1':
                return post_json('http://n8n-email-ui:8789/api/config', {'enabled': bool(enabled)})
        except Exception as e:
            last = e
            time.sleep(2)
    raise RuntimeError(f'Workflow published but its internal control did not become ready: {last}')

def perform(wid, action):
    before = published_state(wid)
    if action == 'pause':
        if wid in SPECIAL:
            try: set_internal_enabled(wid, False)
            except Exception: pass
        if before:
            lifecycle(wid, False)
            restart_n8n()
        after = published_state(wid)
        return {'ok': True, 'id': wid, 'action': action, 'published': after, 'message': 'Workflow paused. Future triggers are disabled.'}
    if action == 'resume':
        if not before:
            lifecycle(wid, True)
            restart_n8n()
        if wid in SPECIAL:
            set_internal_enabled(wid, True)
        after = published_state(wid)
        return {'ok': True, 'id': wid, 'action': action, 'published': after, 'message': 'Workflow resumed and triggers are registered.'}
    if action == 'restart':
        if before:
            lifecycle(wid, False)
        lifecycle(wid, True)
        restart_n8n()
        if wid in SPECIAL:
            set_internal_enabled(wid, True)
        after = published_state(wid)
        return {'ok': True, 'id': wid, 'action': action, 'published': after, 'message': 'Workflow restarted and is active.'}
    raise ValueError('Unsupported action')

class Handler(BaseHTTPRequestHandler):
    server_version = 'WorkflowAction/1.0'
    def log_message(self, fmt, *args):
        print(time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), fmt % args, flush=True)
    def send_json(self, code, value):
        raw = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers(); self.wfile.write(raw)
    def do_GET(self):
        if self.path == '/health': return self.send_json(200, {'ok':True,'service':'workflow-action'})
        return self.send_json(404, {'ok':False,'error':'Not found'})
    def do_POST(self):
        if self.path != '/control': return self.send_json(404, {'ok':False,'error':'Not found'})
        if self.headers.get('X-Control-Token','') != TOKEN:
            return self.send_json(403, {'ok':False,'error':'Forbidden'})
        try:
            n = int(self.headers.get('Content-Length','0'))
            if n <= 0 or n > 4096: return self.send_json(400, {'ok':False,'error':'Invalid request size'})
            data = json.loads(self.rfile.read(n))
            wid = data.get('id'); action = data.get('action')
            if wid not in ALLOWED: return self.send_json(400, {'ok':False,'error':'Workflow is not managed by this control center'})
            if action not in {'pause','resume','restart'}: return self.send_json(400, {'ok':False,'error':'Unsupported action'})
            if not LOCK.acquire(blocking=False): return self.send_json(409, {'ok':False,'error':'Another workflow lifecycle action is in progress'})
            try:
                result = perform(wid, action)
            finally:
                LOCK.release()
            return self.send_json(200, result)
        except Exception as e:
            print(f'lifecycle error: {e}', flush=True)
            return self.send_json(500, {'ok':False,'error':'Workflow lifecycle action failed','detail':str(e)[:1200]})

while True:
    try:
        httpd = ThreadingHTTPServer((BIND, PORT), Handler)
        print(f'Workflow action service listening on {BIND}:{PORT}', flush=True)
        httpd.serve_forever()
    except OSError as e:
        print(f'Bind failed ({e}); retrying...', flush=True)
        time.sleep(3)