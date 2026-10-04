import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('lib/notifications.js', 'utf8');
const context = vm.createContext({});
const module = new vm.SourceTextModule(source, { context });
await module.link(() => { throw new Error('Unexpected import in notification renderer.'); });
await module.evaluate();
const render = module.namespace.buildWorkflowEmail;

const cases = [
  ['needs_correction', 'opportunity', 'Changes were requested for your submission', 'View Submission Status', 'Reviewer feedback'],
  ['rejected', 'event', 'Your submission was not approved', 'View Submission Status', 'Rejection reason'],
  ['published', 'announcement', 'Your submission is now published', 'View Published Listing', null],
];

for (const [notificationType, contentType, heading, action, reasonLabel] of cases) {
  const email = render({
    notificationType,
    contentType,
    title: 'UAT DEMO — Workflow Email <Test>',
    reason: reasonLabel ? 'Please fix the official link & details.' : '',
    destination: 'https://hub.codepv.org/example',
  });
  assert.ok(email.subject.startsWith('C.O.D.E. Hub:'));
  for (const value of [heading, action, `${contentType[0].toUpperCase()}${contentType.slice(1)} Submission`, 'UAT DEMO — Workflow Email']) {
    assert.ok(email.text.includes(value), `Plain text missing: ${value}`);
    assert.ok(email.html.includes(value), `HTML missing: ${value}`);
  }
  assert.ok(email.html.includes('max-width:600px'));
  assert.ok(email.html.includes('This email was sent because you submitted content to the C.O.D.E. Engineering Hub.'));
  assert.ok(!email.html.includes('<Test>'), 'Submission title was not HTML escaped.');
  if (reasonLabel) {
    assert.ok(email.text.includes(reasonLabel));
    assert.ok(email.html.includes(reasonLabel));
    assert.ok(email.html.includes('Please fix the official link &amp; details.'));
  }
}

assert.equal(render({ notificationType: 'unknown', destination: '/' }), null);
console.log('Workflow email render checks passed for correction, rejection, and publication.');
