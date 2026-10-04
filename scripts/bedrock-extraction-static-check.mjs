import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const provider = read('lib/bedrockExtraction.js');
const adapter = read('lib/submissionExtraction.js');
const actions = read('app/panther-submit/actions.js');
const form = read('components/PantherSubmitForm.js');
const envExample = read('.env.local.example');
const packageJson = JSON.parse(read('package.json'));

assert.equal(packageJson.dependencies['@aws-sdk/client-bedrock-runtime'], '3.1136.0', 'Bedrock SDK must be pinned');
assert.ok(provider.includes("BEDROCK_MODEL = 'us.amazon.nova-2-lite-v1:0'"), 'Nova 2 Lite US inference profile is missing');
assert.ok(provider.includes("BEDROCK_REGION = 'us-east-1'"), 'Bedrock region is missing');
assert.ok(provider.includes('ConverseCommand') && provider.includes('maxTokens: 1400'), 'bounded Converse API use is missing');
assert.ok(provider.includes('Never invent missing facts') && provider.includes('Return only valid JSON'), 'safe extraction prompt is missing');
for (const field of ['title', 'organization', 'date', 'start_time', 'end_time', 'location', 'description', 'contact_name', 'contact_email', 'source_url']) {
  assert.ok(provider.includes(field), `normalized field is missing: ${field}`);
}
assert.ok(actions.startsWith("'use server'"), 'Bedrock action is not server-bound');
assert.ok(actions.includes('export async function extractIntakeAction') && actions.includes('extractWithBedrock'), 'server extraction action is missing');
assert.ok(adapter.includes('parseMultipleSources') && adapter.includes('fallbackReason'), 'local/manual fallback is missing');
assert.ok(form.includes('createAndUploadIntake') && form.includes('intakeSessionId: draft?.intakeSessionId'), 'private evidence preparation is missing');
assert.ok(!form.includes('View technical details') && !form.includes('Sources processed'), 'technical extraction diagnostics must not render in the submission flow');
assert.ok(
  form.includes("extractionState === 'success'")
    && form.includes("extractionState === 'partial'")
    && form.includes("extractionState === 'failure'")
    && form.includes('We filled in details from your source. Review them below before submitting.')
    && form.includes('We filled in what we could from your source. Please check and add:')
    && form.includes('Please enter the details below.')
    && !form.includes('Extracted details')
    && !form.includes('AI suggestion; confirm against the original source.'),
  'extraction feedback must distinguish success, partial, and failure states without repeating AI/debug wording',
);
assert.ok(actions.includes('contributorExtractionResult') && actions.includes('isSuperAdmin(viewer)'), 'normal contributors must receive sanitized extraction diagnostics');
assert.ok(form.includes("const result = { ...parsedResult, technical: {} }"), 'submission clients must not retain technical extraction metadata');
assert.ok(form.includes('invalidatePreparedIntake({ resetExtractedFields: true })'), 'changing a source must clear stale extraction state and values');
for (const variable of ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']) {
  assert.ok(envExample.includes(`${variable}=`), `server environment variable is missing: ${variable}`);
  assert.ok(!envExample.includes(`NEXT_PUBLIC_${variable}=`), `${variable} must not be public`);
}
assert.ok(!provider.includes('NEXT_PUBLIC_AWS_') && !actions.includes('NEXT_PUBLIC_AWS_'), 'AWS credentials must never be browser-exposed');
assert.ok(provider.includes("provider: 'amazon-bedrock'") && provider.includes('usage:'), 'technical provider metadata is missing');
assert.ok(provider.includes('mapDegreeEligibilityClassifications'), 'Bedrock results must apply deterministic degree/class-year mapping');
for (const classification of ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate Student']) assert.ok(provider.includes(classification), `Bedrock eligibility guidance missing ${classification}`);
assert.ok(provider.includes('ongoing review') && provider.includes('Do not select Graduating Senior or Recent Graduate when active enrollment is required'), 'Bedrock deadline or active-enrollment guidance is incomplete');
assert.ok(actions.includes("return { ok: false, code }"), 'provider errors must be sanitized');

console.log('Bedrock extraction static checks passed.');
