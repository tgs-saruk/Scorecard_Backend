const jwt = require("jsonwebtoken");
const crypto = require("crypto");

class SessionService {
  static generateAccessToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
  }

  static generateRefreshToken(user) {
    return jwt.sign(
      { id: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
  }

  static generateSessionId() {
    return crypto.randomBytes(16).toString("hex");
  }

  static createSessionObject({ sessionId, deviceInfo, ipAddress }) {
    return {
      sessionId,
      deviceInfo,
      ipAddress,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }
}

module.exports = SessionService;
