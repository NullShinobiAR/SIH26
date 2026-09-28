import assert from 'node:assert';
import { getAuthErrorMessage } from '../src/services/firebase';

console.log('====================================================');
console.log('INTELLIFREIGHT FIREBASE AUTHENTICATION TEST SUITE');
console.log('====================================================\n');

// 1. Test operation-not-allowed guidance
console.log('[1/4] Testing operation-not-allowed guide...');
const notAllowedErr = { code: 'auth/operation-not-allowed', message: 'Operation not allowed' };
const notAllowedRes = getAuthErrorMessage(notAllowedErr);
assert.strictEqual(notAllowedRes.title, 'Google Sign-In Not Enabled in Firebase Console');
assert.ok(notAllowedRes.actionGuide && notAllowedRes.actionGuide.includes('Sign-in method -> Add new provider -> Select Google'));
console.log('  ✓ PASS: operation-not-allowed correctly directs user to Firebase Console setting');

// 2. Test unauthorized-domain guidance
console.log('[2/4] Testing unauthorized-domain guide...');
const unauthDomainErr = { code: 'auth/unauthorized-domain', message: 'Domain not authorized' };
const unauthDomainRes = getAuthErrorMessage(unauthDomainErr);
assert.strictEqual(unauthDomainRes.title, 'Unauthorized Domain for Authentication');
assert.ok(unauthDomainRes.actionGuide && unauthDomainRes.actionGuide.includes('Authorized domains'));
console.log('  ✓ PASS: unauthorized-domain directs user to add hostname to authorized domains');

// 3. Test popup-closed-by-user graceful notice
console.log('[3/4] Testing popup-closed-by-user notice...');
const popupClosedErr = { code: 'auth/popup-closed-by-user', message: 'Popup closed' };
const popupClosedRes = getAuthErrorMessage(popupClosedErr);
assert.strictEqual(popupClosedRes.title, 'Sign-In Cancelled');
assert.ok(popupClosedRes.message.includes('closed before completing authentication'));
console.log('  ✓ PASS: popup-closed-by-user handled gracefully without technical jargon');

// 4. Test popup-blocked browser setting guidance
console.log('[4/4] Testing popup-blocked browser setting...');
const popupBlockedErr = { code: 'auth/popup-blocked', message: 'Popup blocked' };
const popupBlockedRes = getAuthErrorMessage(popupBlockedErr);
assert.strictEqual(popupBlockedRes.title, 'Popup Blocked by Browser');
assert.ok(popupBlockedRes.actionGuide && popupBlockedRes.actionGuide.includes('allow popups'));
console.log('  ✓ PASS: popup-blocked informs user to enable popups');

console.log('\n====================================================');
console.log('AUTHENTICATION ERROR TESTS: 4 / 4 PASSED (100%)');
console.log('====================================================\n');
