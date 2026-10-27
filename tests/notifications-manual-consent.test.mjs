import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { URL } from 'node:url';
import { setImmediate } from 'node:timers';
import console from 'node:console';

const source = readFileSync(new URL('../host-public/notifications/widget.js', import.meta.url), 'utf8')
  .replace(/^import .*?;\n/, '');

test('signed-in visits stay quiet; push settings appear only after clicking the bell', async () => {
  // Two independent page contexts represent a return visit with fresh session storage.
  for (let visit = 0; visit < 2; visit++) {
    class Node {
      constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.style = {}; }
      append(...nodes) { this.children.push(...nodes); }
      replaceChildren(...nodes) { this.children = nodes; }
      setAttribute() {}
      addEventListener(event, callback) { this.listeners[event] = callback; }
    }
    const body = new Node('body');
    const timers = [];
    const visits = [];
    const query = { select() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: [] }); } };
    let permissionRequests = 0;
    const context = vm.createContext({
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'resident' } } }), onAuthStateChange() {} },
        from: () => query,
      }),
      document: { body, head: new Node('head'), hidden: false, createElement: tag => new Node(tag),
        getElementById: () => null, querySelector: () => null, addEventListener() {} },
      navigator: { serviceWorker: {} }, window: { PushManager: {}, Notification: {} },
      Notification: { permission: 'default', requestPermission() { permissionRequests++; } },
      location: { protocol: 'https:', assign: path => visits.push(path) },
      setTimeout: callback => timers.push(callback), setInterval() {}, clearInterval() {}, console,
    });
    vm.runInContext(source, context);
    await new Promise(resolve => setImmediate(resolve));
    for (const timer of timers) timer();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(body.children.map(node => node.tag), ['button', 'section']);
    const [bell, popover] = body.children;
    assert.equal(popover.hidden, true);
    assert.equal(permissionRequests, 0);
    assert.deepEqual(visits, []);
    bell.listeners.click();
    assert.equal(popover.hidden, false);
    const enable = popover.children.find(node => node.textContent === 'Включить push');
    assert.ok(enable, 'the resident retains an explicit way to enable push');
    assert.equal(permissionRequests, 0);
    enable.listeners.click();
    assert.deepEqual(visits, ['/notifications/#push']);
  }
});
