import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createPageUnloadController } from '../src/backend/services/pageUnloadService.js';

function setup() {
  const calls = [];
  const controller = createPageUnloadController({ quit: () => calls.push('quit') });
  const contents = Object.assign(new EventEmitter(), {
    id: 1,
    reload: () => calls.push('reload')
  });
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false,
    close: () => calls.push('close')
  });
  controller.registerWindow(window);

  function block(action) {
    if (action === 'quit') controller.requestQuit();
    if (action !== 'reload') window.emit('close');
    contents.emit('will-prevent-unload');
  }

  return { controller, contents, window, calls, block };
}

for (const action of ['close', 'quit', 'reload']) {
  test(`waits for confirmation before resuming ${action}`, () => {
    const { controller, contents, calls, block } = setup();
    block(action);
    assert.deepEqual(calls, []);
    controller.respondToUnload(contents, true);
    assert.deepEqual(calls, [action]);
    controller.respondToUnload(contents, true);
    assert.deepEqual(calls, [action], 'duplicate responses must not repeat the operation');
  });

  test(`cancelling ${action} preserves the window and allows another attempt`, () => {
    const { controller, contents, calls, block } = setup();
    block(action);
    controller.respondToUnload(contents, false);
    assert.deepEqual(calls, []);
    controller.respondToUnload(contents, true);
    assert.deepEqual(calls, [], 'a dismissed confirmation cannot be accepted later');
    block(action);
    controller.respondToUnload(contents, true);
    assert.deepEqual(calls, [action]);
  });
}

test('cancelling quit does not turn the next window close into an app quit', () => {
  const { controller, contents, calls, block } = setup();
  block('quit');
  controller.respondToUnload(contents, false);
  block('close');
  controller.respondToUnload(contents, true);
  assert.deepEqual(calls, ['close']);
});

test('a reload after a blocked close resumes a reload', () => {
  const { controller, contents, calls, block } = setup();
  block('close');
  block('reload');
  controller.respondToUnload(contents, true);
  assert.deepEqual(calls, ['reload']);
});

test('a new quit request replaces a pending close request', () => {
  const { controller, contents, calls, block } = setup();
  block('close');
  block('quit');
  controller.respondToUnload(contents, true);
  assert.deepEqual(calls, ['quit']);
});

test('ignores confirmations from a different window or after the page has reloaded', () => {
  const { controller, contents, calls, block } = setup();
  block('close');
  controller.respondToUnload({ id: 2 }, true);
  assert.deepEqual(calls, []);
  contents.emit('did-finish-load');
  controller.respondToUnload(contents, true);
  assert.deepEqual(calls, []);
});

test('ignores responses after a window is destroyed or closed', () => {
  const { controller, contents, window, calls, block } = setup();
  block('close');
  window.isDestroyed = () => true;
  controller.respondToUnload(contents, true);
  assert.deepEqual(calls, []);
  window.emit('closed');
  window.isDestroyed = () => false;
  controller.respondToUnload(contents, true);
  assert.deepEqual(calls, []);
});
