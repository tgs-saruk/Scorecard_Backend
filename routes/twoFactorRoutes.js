const express = require("express");
const TwoFactorController = require("../controllers/twoFactorController");
const { auth } = require("../middlewares/authentication");

const router = express.Router();

/**
 * 2FA Routes
 * All routes require authentication middleware
 */

/**
 * GET /auth/2fa/setup
 * Initiate 2FA setup - Generate QR code
 */
router.get("/setup", auth, TwoFactorController.setupInitiate);

/**
 * POST /auth/2fa/setup
 * Verify and enable 2FA
 * Body: { token: "123456", secret: "..." }
 */
router.post("/setup", auth, TwoFactorController.setupVerify);

/**
 * GET /auth/2fa/status
 * Get current 2FA status for the user
 */
router.get("/status", auth, TwoFactorController.getStatus);

/**
 * POST /auth/2fa/verify
 * Verify TOTP token or backup code during login
 * Body: { token: "123456" } OR { backupCode: "ABCD1234" }
 */
router.post("/verify", auth, TwoFactorController.verify);

/**
 * POST /auth/2fa/disable
 * Disable 2FA for the user
 * Body: { password: "..." }
 */
router.post("/disable", auth, TwoFactorController.disable);

/**
 * GET /auth/2fa/backup-codes
 * Get backup codes status (shows which ones are used)
 */
router.get("/backup-codes", auth, TwoFactorController.getBackupCodes);

/**
 * POST /auth/2fa/backup-codes/regenerate
 * Regenerate backup codes
 */
router.post(
  "/backup-codes/regenerate",
  auth,
  TwoFactorController.regenerateBackupCodes,
);

module.exports = router;
