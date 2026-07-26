import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, isSuperAdminEmail, isAdminEmail } from '../auth';

describe('Auth Utility Functions', () => {
  describe('normalizeEmail', () => {
    it('should lowercase and trim email addresses', () => {
      assert.equal(normalizeEmail('  Test.User@Domain.COM  '), 'test.user@domain.com');
      assert.equal(normalizeEmail('ADMIN@PSUSCC.CLUB'), 'admin@psuscc.club');
    });

    it('should handle null and undefined gracefully', () => {
      assert.equal(normalizeEmail(null), '');
      assert.equal(normalizeEmail(undefined), '');
    });
  });

  describe('isSuperAdminEmail', () => {
    it('should correctly identify super admin email or return false for empty super admin', () => {
      assert.equal(isSuperAdminEmail(null), false);
      assert.equal(isSuperAdminEmail(''), false);
    });
  });

  describe('isAdminEmail', () => {
    it('should return false for empty or invalid emails', () => {
      assert.equal(isAdminEmail(null), false);
      assert.equal(isAdminEmail(''), false);
      assert.equal(isAdminEmail('random_user@example.com'), false);
    });
  });
});
