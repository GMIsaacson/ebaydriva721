const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Source Graph control API is read-only, authenticated and projection-only', async () => {
  const source = read('api/source-graph-control.js');
  assert.match(source, /requireUser\(req\)/);
  assert.match(source, /source_graph_control_dashboard/);
  assert.match(source, /sb_publishable_/);
  assert.doesNotMatch(source, /service[_-]?role/i);
  assert.doesNotMatch(source, /source_graph_runs\?/);
  assert.doesNotMatch(source, /source_graph_resolution_tasks\?/);

  const handler = require(path.join(root, 'api/source-graph-control.js'));

  function responseHarness() {
    return {
      statusCode: 200,
      headers: {},
      body: undefined,
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  const writeRes = responseHarness();
  await handler({ method: 'POST', headers: {} }, writeRes);
  assert.equal(writeRes.statusCode, 405);
  assert.equal(writeRes.body?.error, 'METHOD_NOT_ALLOWED');

  const readRes = responseHarness();
  await handler({ method: 'GET', headers: {} }, readRes);
  assert.equal(readRes.statusCode, 401);
  assert.equal(readRes.body?.error, 'AUTH_REQUIRED');
});

test('Factory Source Graph route is protected and controls are fail-closed', () => {
  const app = read('src/App.jsx');
  const shell = read('src/FactoryShell.jsx');
  const panel = read('src/SourceGraphControl.jsx');
  const decision = JSON.parse(read('agent-factory/governance/a0-decisions/A0-SOURCEMARGIN-SOURCE-GRAPH-CONTROL-001.a0.json'));

  assert.match(app, /path="source-graph"/);
  assert.match(app, /<ProtectedRoute>[\s\S]*?<ErrorBoundary><SourceGraphControl \/><\/ErrorBoundary>[\s\S]*?<\/ProtectedRoute>/);
  assert.match(shell, /\/factory-control\/source-graph/);
  assert.match(panel, /<button disabled[^>]*>Pause<\/button>/);
  assert.match(panel, /<button disabled[^>]*>Restart<\/button>/);
  assert.match(panel, /<button disabled[^>]*>Retry<\/button>/);

  assert.equal(decision.status, 'PASS');
  assert.equal(decision.verdict, 'EXTEND');
  assert.match(decision.duplication_analysis, /Do not create a Source Graph mini-factory/);
});
