const crypto = require("crypto");

class OtpService {
  /**
   * Generate a secure One-Time Password (OTP)
   * @param {Object} params Configuration object
   * @param {number} params.length Length of the OTP (default: 6)
   * @param {boolean} params.numeric Generate numeric OTP only (default: true)
   * @returns {string} Generated OTP
   */
  static generateOtp({ length = 6, numeric = true } = {}) {
    if (numeric) {
      const min = Math.pow(10, length - 1);
      const max = Math.pow(10, length) - 1;
      return crypto.randomInt(min, max + 1).toString();
    }

    return crypto
      .randomBytes(length)
      .toString("hex")
      .slice(0, length)
      .toUpperCase();
  }

  /**
   * Format OTP for display (e.g. 123456 → 1 2 3 4 5 6)
   * @param {string} otp
   * @returns {string}
   */
  static formatOTPForDisplay(otp) {
    return otp.split("").join(" ");
  }

  /**
   * Generate OTP Email HTML Template
   * @param {string} otp One-Time Password
   * @param {string} userName Recipient name
   * @param {number} expiryMinutes Expiry time in minutes
   * @returns {string} HTML email template
   */
  static generateOTPEmailTemplate(
    otp,
    userName = "Admin",
    expiryMinutes = 5
  ) {
    const formattedOTP = this.formatOTPForDisplay(otp);

    return `
    <div style="width:100%;background:#f8f9fa;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
      <div style="max-width:600px;margin:0 auto">

        <div style="text-align:center;margin-bottom:30px">
          <h1 style="margin:0;font-size:28px;font-weight:700;color:#1e3a5f">
            SBA Pro-Life Scorecard
          </h1>
          <p style="margin:6px 0 0;font-size:14px;color:#666">
            Login Verification
          </p>
        </div>

        <div style="background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08)">

          <p style="font-size:16px;color:#333">
            Hello <strong>${userName}</strong>,
          </p>

          <p style="font-size:15px;color:#555;line-height:1.6">
            You are trying to sign in to your SBA Pro-Life Scorecard Admin account.
            Use the verification code below to continue:
          </p>

          <div style="margin:30px 0;text-align:center;background:linear-gradient(135deg,#667eea,#764ba2);padding:28px;border-radius:8px">
            <div style="font-size:13px;color:rgba(255,255,255,.9);letter-spacing:1px">
              VERIFICATION CODE
            </div>
            <div style="margin-top:10px;font-size:36px;font-weight:700;color:#fff;letter-spacing:6px;font-family:'Courier New',monospace">
              ${formattedOTP}
            </div>
          </div>

          <div style="background:#f0f4ff;border-left:4px solid #667eea;padding:14px;border-radius:4px">
            <p style="margin:0;font-size:13px;color:#555">
              ⏱️ This code expires in <strong>${expiryMinutes} minutes</strong>
            </p>
          </div>

          <div style="margin-top:20px;background:#fff3cd;border-left:4px solid #ffc107;padding:14px;border-radius:4px">
            <p style="margin:0;font-size:13px;color:#856404">
              ⚠️ Never share this code with anyone. SBA will never ask for it.
            </p>
          </div>

          <p style="margin-top:25px;font-size:14px;color:#666">
            If you did not request this login, please ignore this email or contact your administrator.
          </p>
        </div>

        <div style="text-align:center;margin-top:30px;font-size:12px;color:#999">
          © ${new Date().getFullYear()} SBA Pro-Life. All rights reserved.
        </div>

      </div>
    </div>
    `;
  }
}

module.exports = OtpService;
