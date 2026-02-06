const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: String,
    nickName: String,
    email: { type: String, unique: true },
    password: {
      type: String,
    },
    role: { type: String, enum: ["admin", "editor", "contributor"] },
    status: {
      type: String,
      default: "active",
      enum: ["active", "inactive"],
    },
    otpHash: String,
    otpExpiry: Date,
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: Date,
    inviteToken: String,
    tokenExpiry: Date,
    invitedAt: Date,
    activatedAt: Date,
    // 2FA Fields
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: String,
    backupCodes: [
      {
        code: String,
        used: {
          type: Boolean,
          default: false,
        },
        usedAt: Date,
      },
    ],
    // 2FA Attempts - ADD THIS
    twoFactorAttempts: {
      type: Number,
      default: 0,
    },
    twoFactorLockedUntil: Date,
    // Session Management
    activeSessions: [
      {
        sessionId: String,
        deviceInfo: String,
        ipAddress: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
        lastActivityAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: Date,
      },
    ],
    lastLoginAt: Date,
    lastLoginIP: String,
    // Account Security
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    accountLockedUntil: Date,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("users", UserSchema);