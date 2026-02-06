const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");

class TwoFactorService {
  static async generateSecret(email) {
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `Scorecard Admin (${email})`,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode,
      manualEntryKey: secret.base32,
    };
  }

  static verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1,
    });
  }

  static async generateBackupCodes(count = 10) {
    const codes = [];
    const hashedCodes = [];

    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      codes.push(code);

      hashedCodes.push({
        code: await bcrypt.hash(code, 10),
        used: false,
        usedAt: null,
      });
    }

    return { codes, hashedCodes };
  }

  static async verifyBackupCode(inputCode, storedCodes) {
    for (let i = 0; i < storedCodes.length; i++) {
      if (storedCodes[i].used) continue;

      const match = await bcrypt.compare(inputCode, storedCodes[i].code);
      if (match) {
        storedCodes[i].used = true;
        storedCodes[i].usedAt = new Date();
        return { isValid: true, updatedCodes: storedCodes };
      }
    }
    return { isValid: false };
  }

  static getRemainingBackupCodesCount(codes = []) {
    return codes.filter((c) => !c.used).length;
  }
}

module.exports = TwoFactorService;
