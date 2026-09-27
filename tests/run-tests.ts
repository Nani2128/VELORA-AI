import { hashPassword, verifyPassword } from '../src/server/auth';
import { db } from '../src/server/db';
import { chatRouter } from '../src/server/chatProviders/router';
import { modelRegistry } from '../src/server/imageProviders/registry';
import { falFluxImageProvider } from '../src/server/imageProviders/falFlux';
import { capabilityRouter } from '../src/server/router/capabilityRouter';
import { classifyProviderError } from '../src/server/errors/normalizedError';
import { normalizeAPIError } from '../src/lib/api/errors';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? '- ' + detail : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- [VELORA AI PHASE 04 - 07 COMPREHENSIVE TEST SUITE] ---');

  // ==========================================
  // TEST GROUP 1: AUTHENTICATION & SECURITY
  // ==========================================
  console.log('\n1. Authentication & Password Security:');
  const testPassword = 'CreativeStudioPass2026!';
  const { hash, salt } = hashPassword(testPassword);
  assert(hash.length > 32, 'Password hash generated securely with scrypt');
  assert(salt.length >= 16, 'Password salt generated with crypto random bytes');
  assert(verifyPassword(testPassword, hash, salt), 'Correct password verifies successfully');
  assert(!verifyPassword('WrongPassword123', hash, salt), 'Incorrect password is rejected');

  const testEmail = `creator_${Date.now()}@velora.ai`;
  const user = db.createUser(testEmail, 'Elena Test', hash, salt);
  assert(user.email === testEmail, 'User persisted in database');
  assert(user.password_hash === hash, 'Password hash stored, never plaintext');

  const token = db.createSession(user.id);
  const session = db.getSession(token);
  assert(session !== null && session.user_id === user.id, 'Session token created and retrievable');

  db.deleteSession(token);
  assert(db.getSession(token) === null, 'Session deleted upon logout');

  // ==========================================
  // TEST GROUP 2: AI ROUTER & MULTI-PROVIDER FALLBACK
  // ==========================================
  console.log('\n2. Multi-Provider Router & Fallback Logic:');
  const providers = chatRouter.listProviders();
  assert(providers.length >= 4, `All 4 chat providers registered (Gemini, OpenAI, Ollama, Gateway). Found: ${providers.length}`);

  const gemini = chatRouter.getProvider('gemini')!;
  assert(gemini !== undefined, 'Gemini chat provider found in router');
  
  // Test rate limiting simulation
  gemini.markRateLimited(2, 'Simulated 429 quota exhaustion');
  const geminiHealth = gemini.getHealthState();
  assert(geminiHealth.status === 'RATE_LIMITED', 'Gemini status correctly marked RATE_LIMITED');
  assert(gemini.isAvailable() === false, 'Gemini marked unavailable during active cooldown');

  try {
    await chatRouter.routeAndStreamChat(
      [{ role: 'user', content: 'Test prompt' }],
      { model: 'gemini' },
      () => {}
    );
    assert(false, 'Should have thrown error when all specified providers unavailable');
  } catch (err: any) {
    assert(err.message.includes('PROVIDER_RATE_LIMITED') || err.message.includes('cooling down'), 'Normalized error returned when providers exhausted (No raw JSON stack traces)');
  }

  // ==========================================
  // TEST GROUP 3: ERROR NORMALIZATION
  // ==========================================
  console.log('\n3. Error Normalization & UI Contracts:');
  const err429 = normalizeAPIError({ message: '429 Too Many Requests: RESOURCE_EXHAUSTED' });
  assert(err429.code === 'PROVIDER_RATE_LIMITED', '429 error normalized to PROVIDER_RATE_LIMITED');
  assert(err429.retryable === true, 'Rate limit error is marked retryable');
  assert(err429.actionText === 'Provider Settings' || err429.actionText === 'Retry Request', 'Actionable button provided');

  const errAuth = normalizeAPIError({ code: 'UNAUTHORIZED' });
  assert(errAuth.title === 'Authentication Required', 'UNAUTHORIZED error title is friendly');
  assert(errAuth.actionType === 'login', 'Directs user to login');

  // ==========================================
  // TEST GROUP 4: MODEL REGISTRY & CAPABILITIES
  // ==========================================
  console.log('\n4. Model Registry & Capabilities Control Plane:');
  const models = await modelRegistry.getModels();
  assert(models.length >= 7, `Unified registry contains at least 7 models across image, video. Found: ${models.length}`);

  const fluxModel = models.find((m) => m.id === 'flux-1-schnell');
  assert(fluxModel !== undefined, 'FLUX.1 [schnell] model present in registry');
  assert(fluxModel?.provider === 'flux', 'FLUX provider metadata accurate');
  assert(fluxModel?.supports_aspect_ratio === true, 'FLUX aspect ratio capability marked');

  const sdModel = models.find((m) => m.id === 'sdxl-1.0');
  assert(sdModel !== undefined, 'Stable Diffusion XL present in registry');

  const veoModel = models.find((m) => m.id.includes('veo'));
  assert(veoModel !== undefined, 'Google Veo video present in registry');

  // ==========================================
  // TEST GROUP 5: PHASE 07 FAL.AI & FLUX.1 SCHNELL
  // ==========================================
  console.log('\n5. Phase 07 Fal.ai & FLUX.1 Schnell Integration:');
  const falModel = models.find((m) => m.id === 'fal-ai/flux/schnell');
  assert(falModel !== undefined, 'Fal.ai FLUX.1 Schnell present in model registry');
  assert(falModel?.provider === 'fal', 'Fal.ai provider tag is accurate');
  assert(falModel?.supports_text_to_image === true, 'Fal.ai FLUX supports text_to_image');
  assert(falModel?.supports_aspect_ratio === true, 'Fal.ai FLUX supports aspect ratio control');
  assert(falModel?.supports_seed === true, 'Fal.ai FLUX supports seed control');

  // Verify Fal provider contract
  assert(falFluxImageProvider.id === 'fal', 'Fal provider ID matches contract');
  assert(falFluxImageProvider.providerType === 'cloud', 'Fal provider type is cloud');
  assert(falFluxImageProvider.supports('text_to_image'), 'Fal provider supports text_to_image');
  assert(falFluxImageProvider.supports('aspect_ratio'), 'Fal provider supports aspect_ratio');
  assert(typeof falFluxImageProvider.generate === 'function', 'Fal provider has callable generate()');
  assert(typeof falFluxImageProvider.health === 'function', 'Fal provider has callable health()');

  // Test Task Intent Classification
  console.log('\n6. Phase 07 Intent Classification & Capability Routing:');
  const imageTask = capabilityRouter.classifyTask('Create an image of futuristic Hyderabad skyline at night');
  assert(imageTask === 'TEXT_TO_IMAGE', 'Classifies image request directive as TEXT_TO_IMAGE');

  const videoTask = capabilityRouter.classifyTask('Create a video of golden hour waves crashing gently');
  assert(videoTask === 'TEXT_TO_VIDEO', 'Classifies video request directive as TEXT_TO_VIDEO');

  const chatTask = capabilityRouter.classifyTask('Explain the architecture of rectified flow transformers');
  assert(chatTask === 'CHAT', 'Classifies theoretical question as CHAT');

  // Test Quota Error Normalization
  console.log('\n7. Phase 07 Quota Normalization & Failover Chains:');
  const classifiedFal429 = classifyProviderError({ status: 429, message: 'Rate limit reached on queue' }, 'fal', 'fal-ai/flux/schnell');
  assert(classifiedFal429.code === 'PROVIDER_RATE_LIMITED' || classifiedFal429.code === 'PROVIDER_QUOTA_EXHAUSTED', 'Fal 429 classified to normalized error code');
  assert(classifiedFal429.retryable === true, 'Fal rate limit marked retryable');

  const classifiedGeminiQuota = classifyProviderError(
    { error: { code: 429, message: 'You exceeded your current quota... limit = 0', status: 'RESOURCE_EXHAUSTED' } },
    'google',
    'gemini-3.1-flash-image'
  );
  assert(classifiedGeminiQuota.code === 'PROVIDER_QUOTA_EXHAUSTED', 'Gemini RESOURCE_EXHAUSTED normalized to PROVIDER_QUOTA_EXHAUSTED');

  // Route Planning with fallback
  const plan = await capabilityRouter.planRoute('TEXT_TO_IMAGE', 'gemini-3.1-flash-image');
  assert(plan !== null && plan.primaryModel !== null, 'Route planned for TEXT_TO_IMAGE');
  assert(Array.isArray(plan.fallbackChain), 'Route fallback chain is an array');

  // Real API test (only when explicitly enabled via RUN_REAL_PROVIDER_TESTS=true)
  if (process.env.RUN_REAL_PROVIDER_TESTS === 'true' && process.env.FAL_KEY) {
    console.log('\n8. Optional Real Fal.ai Live API Test:');
    try {
      const realResult = await falFluxImageProvider.generate('Minimalist geometric circle on white background', {
        aspectRatio: '1:1',
      });
      assert(realResult.success === true, 'Real Fal.ai FLUX generation succeeded');
      assert(!!realResult.asset?.publicUrl, 'Real Fal.ai asset public URL returned');
    } catch (err: any) {
      console.warn('Real Fal API test encountered exception:', err?.message);
    }
  }

  // Summary
  console.log(`\n--- TEST RESULTS: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
