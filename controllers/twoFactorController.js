const bcrypt = require("bcryptjs");
const User = require("../models/userSchema");
const TwoFactorService = require("../helper/twoFactorService");
const SessionService = require("../helper/sessionService");

class TwoFactorController {
  /**
   * Setup 2FA - Generate QR code
   * GET /auth/2fa/setup
   */
  static async setupInitiate(req, res) {
    try {
      const userId = req.user._id;

      // Check if 2FA already enabled
      const user = await User.findById(userId);
      if (user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: "2FA is already enabled. Disable it first to set up again.",
        });
      }

      // Generate new secret
      const { secret, qrCode, manualEntryKey } =
        await TwoFactorService.generateSecret(user.email);

      res.status(200).json({
        success: true,
        message: "QR code generated successfully",
        data: {
          qrCode,
          manualEntryKey,
          // Don't send secret in response for security
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error generating 2FA setup",
        error: error.message,
      });
    }
  }

  /**
   * Verify and enable 2FA
   * POST /auth/2fa/setup
   * Body: { token: "123456" }
   */
  static async setupVerify(req, res) {
  try {
    const { token, secret } = req.body;
    const userId = req.user._id;

    if (!token || !secret) {
      return res.status(400).json({
        success: false,
        message: "Token and secret are required",
      });
    }

    if (token.length !== 6 || isNaN(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid token format. Please enter a 6-digit code.",
      });
    }

    // Verify the token with provided secret
    const isValid = TwoFactorService.verifyToken(secret, token);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code. Please try again.",
      });
    }

    // Generate backup codes
    const { codes, hashedCodes } =
      await TwoFactorService.generateBackupCodes();

    // Save to database
    const user = await User.findByIdAndUpdate(
      userId,
      {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        backupCodes: hashedCodes,
      },
      { new: true },
    );

    // ✅ Generate session tokens for immediate login
    const accessToken = SessionService.generateAccessToken(user);
    const refreshToken = SessionService.generateRefreshToken(user);
    const sessionId = SessionService.generateSessionId();

    // Get device info from request headers
    const deviceInfo = req.headers["user-agent"] || "Unknown Device";
    const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    // Add session to active sessions
    const newSession = SessionService.createSessionObject({
      sessionId,
      deviceInfo,
      ipAddress,
    });

    // Update user with new session
    await User.findByIdAndUpdate(userId, {
      $push: { activeSessions: newSession },
      lastLoginAt: new Date(),
      lastLoginIP: ipAddress,
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    });

    res.status(200).json({
      success: true,
      message: "2FA enabled successfully",
      data: {
        backupCodes: codes, // Show backup codes only once
        accessToken, // ✅ Add access token
        refreshToken, // ✅ Add refresh token
        sessionId, // ✅ Add session ID
        message:
          "Save these backup codes in a secure location. You can use them to login if you lose access to your authenticator app.",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying 2FA setup",
      error: error.message,
    });
  }
}
  /**
   * Get current 2FA status
   * GET /auth/2fa/status
   */
  static async getStatus(req, res) {
    try {
      const user = await User.findById(req.user._id);

      res.status(200).json({
        success: true,
        data: {
          twoFactorEnabled: user.twoFactorEnabled,
          backupCodesRemaining: TwoFactorService.getRemainingBackupCodesCount(
            user.backupCodes,
          ),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error getting 2FA status",
        error: error.message,
      });
    }
  }

  /**
   * Verify TOTP or backup code during login
   * POST /auth/2fa/verify
   * Body: { token: "123456" } OR { backupCode: "ABCD1234" }
   */
static async verify(req, res) {
  try {
    const { token, backupCode } = req.body;
    const userId = req.user._id;

    if (!token && !backupCode) {
      return res.status(400).json({
        success: false,
        message: "Either TOTP token or backup code is required",
        requiresTwoFactor: true,
      });
    }

    const user = await User.findById(userId);

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: "2FA is not enabled for this account",
        requiresTwoFactor: true,
      });
    }

    // Backup code verification (no attempt limits)
    if (backupCode) {
      const { isValid: backupValid, updatedCodes } =
        await TwoFactorService.verifyBackupCode(backupCode, user.backupCodes);

      if (!backupValid) {
        return res.status(200).json({
          success: false,
          message: "Invalid backup code",
          requiresTwoFactor: true,
        });
      }

      // Reset 2FA attempts on successful backup code
      await User.findByIdAndUpdate(userId, {
        backupCodes: updatedCodes,
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
      });

      // Alert user if backup codes running low
      const remaining = TwoFactorService.getRemainingBackupCodesCount(updatedCodes);
      if (remaining <= 3) {
        console.warn(`User ${userId} has only ${remaining} backup codes left`);
      }

      // Generate access token for backup code login
      const accessToken = SessionService.generateAccessToken(user);
      const refreshToken = SessionService.generateRefreshToken(user);
      const sessionId = SessionService.generateSessionId();

      // Get device info from request headers
      const deviceInfo = req.headers["user-agent"] || "Unknown Device";
      const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

      // Add session to active sessions
      const newSession = SessionService.createSessionObject({
        sessionId,
        deviceInfo,
        ipAddress,
      });

      await User.findByIdAndUpdate(userId, {
        $push: { activeSessions: newSession },
        lastLoginAt: new Date(),
        lastLoginIP: ipAddress,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
      });

      return res.status(200).json({
        success: true,
        message: "2FA verification successful",
        data: {
          accessToken,
          refreshToken,
          sessionId,
          usedBackupCode: true,
        },
      });
    }

    // TOTP token verification with attempt limits
    if (token) {
      if (token.length !== 6 || isNaN(token)) {
        return res.status(400).json({
          success: false,
          message: "Invalid token format. Please enter a 6-digit code.",
          requiresTwoFactor: true,
        });
      }

      // Check if 2FA verification is locked
      const now = new Date();
      if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > now) {
        const minutesLeft = Math.ceil((user.twoFactorLockedUntil - now) / (1000 * 60));
        
        return res.status(200).json({
          success: false,
          message: `Too many failed attempts. Please try again in ${minutesLeft} minute(s).`,
          requiresTwoFactor: true,
          errorType: "TWO_FACTOR_LOCKED",
          retryAfter: minutesLeft,
          attemptsRemaining: 0,
        });
      }

      const isValid = TwoFactorService.verifyToken(user.twoFactorSecret, token);
      console.log("isValid:", isValid);
      
      if (!isValid) {
        // Increment failed attempts
        const newAttemptCount = (user.twoFactorAttempts || 0) + 1;
        let updateData = {
          twoFactorAttempts: newAttemptCount
        };

        // Lock after 5 failed attempts for 15 minutes
        if (newAttemptCount >= 5) {
          const lockDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
          updateData.twoFactorLockedUntil = new Date(now.getTime() + lockDuration);
          
          await User.findByIdAndUpdate(userId, updateData);

          return res.status(200).json({
            success: false,
            message: "Too many failed attempts. Please try again in 15 minutes.",
            requiresTwoFactor: true,
            errorType: "TWO_FACTOR_LOCKED",
            retryAfter: 15,
            attemptsRemaining: 0,
          });
        }

        // Save attempt count
        await User.findByIdAndUpdate(userId, updateData);

        const attemptsRemaining = 5 - newAttemptCount;
        
        return res.status(200).json({
          success: false,
          message: `Invalid verification code. ${attemptsRemaining} attempt(s) remaining.`,
          requiresTwoFactor: true,
          attemptsRemaining,
          totalAttempts: newAttemptCount,
        });
      }

      // ✅ Valid token - Reset attempts and proceed
      await User.findByIdAndUpdate(userId, {
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
      });

      // Generate access token
      const accessToken = SessionService.generateAccessToken(user);
      const refreshToken = SessionService.generateRefreshToken(user);
      const sessionId = SessionService.generateSessionId();

      // Get device info from request headers
      const deviceInfo = req.headers["user-agent"] || "Unknown Device";
      const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

      // Add session to active sessions
      const newSession = SessionService.createSessionObject({
        sessionId,
        deviceInfo,
        ipAddress,
      });

      await User.findByIdAndUpdate(userId, {
        $push: { activeSessions: newSession },
        lastLoginAt: new Date(),
        lastLoginIP: ipAddress,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
      });

      return res.status(200).json({
        success: true,
        message: "2FA verification successful",
        data: {
          accessToken,
          refreshToken,
          sessionId,
        },
      });
    }
  } catch (error) {
    console.error("Error in 2FA verification:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying 2FA",
      requiresTwoFactor: true,
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error",
    });
  }
}

  /**
   * Disable 2FA
   * POST /auth/2fa/disable
   * Body: { password: "..." }
   */
  static async disable(req, res) {
    try {
      const { password } = req.body;
      const userId = req.user._id;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required to disable 2FA",
        });
      }

      const user = await User.findById(userId);

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid password",
        });
      }

      // Disable 2FA
      await User.findByIdAndUpdate(userId, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      });

      res.status(200).json({
        success: true,
        message: "2FA disabled successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error disabling 2FA",
        error: error.message,
      });
    }
  }

  /**
   * Get backup codes
   * GET /auth/2fa/backup-codes
   */
  static async getBackupCodes(req, res) {
    try {
      const user = await User.findById(req.user._id);

      const backupCodes = user.backupCodes.map((code) => ({
        used: code.used,
        usedAt: code.usedAt,
      }));

      res.status(200).json({
        success: true,
        data: {
          backupCodes,
          remaining: TwoFactorService.getRemainingBackupCodesCount(
            user.backupCodes,
          ),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error getting backup codes",
        error: error.message,
      });
    }
  }

  /**
   * Regenerate backup codes
   * POST /auth/2fa/backup-codes/regenerate
   */
  static async regenerateBackupCodes(req, res) {
    try {
      const userId = req.user._id;

      const { codes, hashedCodes } =
        await TwoFactorService.generateBackupCodes();

      await User.findByIdAndUpdate(userId, {
        backupCodes: hashedCodes,
      });

      res.status(200).json({
        success: true,
        message: "Backup codes regenerated successfully",
        data: {
          backupCodes: codes,
          message: "Save these new backup codes in a secure location.",
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error regenerating backup codes",
        error: error.message,
      });
    }
  }
}

module.exports = TwoFactorController;
