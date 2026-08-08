/**
 * Provider-neutral contracts for Panther Hub.
 *
 * JavaScript does not enforce interfaces at runtime, so these factories
 * document and validate the deliberately small seams used by the pilot.
 * Provider implementations should remain server-only unless explicitly
 * documented otherwise.
 */

const CONTRACT_METHODS = Object.freeze({
  ContentRepository: ['listPublished', 'getPublished', 'createPending', 'review'],
  IdentityProvider: ['getCurrentIdentity', 'signOut'],
  FileStorage: ['createUpload', 'getReviewUrl', 'remove'],
  MailConnector: ['isEnabled', 'listIntakeCandidates', 'createDraftFromMessage'],
  ParserProvider: ['parse'],
  EmailSender: ['send'],
  HealthProvider: ['check'],
});

export function assertProviderContract(name, provider) {
  const methods = CONTRACT_METHODS[name];
  if (!methods) throw new Error(`Unknown provider contract: ${name}`);
  for (const method of methods) {
    if (typeof provider?.[method] !== 'function') {
      throw new Error(`${name} provider is missing method: ${method}`);
    }
  }
  return provider;
}

export function createDisabledMailConnector() {
  return assertProviderContract('MailConnector', {
    isEnabled: () => false,
    listIntakeCandidates: async () => [],
    createDraftFromMessage: async () => {
      throw new Error('Mail intake is disabled for the pilot.');
    },
  });
}
