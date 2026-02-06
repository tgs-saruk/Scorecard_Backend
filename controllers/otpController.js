
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userSchema');
const JWT_SECRET = process.env.JWT_SECRET;
const OtpService  = require('../helper/otpService');
const  sendEmail  = require('../config/send-email');

class OtpController {
  // 🔐 VERIFY OTP
  static async verify(req, res) {
    try {
      const { otp, tempToken } = req.body;

      if (!otp || !tempToken) {
        return res.status(400).json({ message: "OTP required" });
      }

      const decoded = jwt.verify(tempToken, JWT_SECRET);
      if (decoded.purpose !== "OTP_VERIFY") {
        return res.status(401).json({ message: "Invalid token" });
      }

      const user = await User.findById(decoded.id);
      if (!user || !user.otpHash) {
        return res.status(400).json({ message: "OTP not found" });
      }

      if (user.otpExpiry < new Date()) {
        return res.status(400).json({ message: "OTP expired" });
      }

      // 🚫 Max attempts
      if (user.otpAttempts >= 5) {
        return res.status(429).json({
          message: "Too many failed attempts. Please resend OTP.",
        });
      }

      const isValid = await bcrypt.compare(otp, user.otpHash);

      if (!isValid) {
        user.otpAttempts += 1;
        await user.save();

        return res.status(400).json({
          message: `Invalid OTP. ${5 - user.otpAttempts} attempts left.`,
        });
      }

      // ✅ SUCCESS
      user.otpHash = null;
      user.otpExpiry = null;
      user.otpAttempts = 0;
      user.otpLastSentAt = null;
      await user.save();

      const token = jwt.sign(
        { id: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      return res.status(200).json({
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          nickName: user.nickName,
          role: user.role,
        },
      });
    } catch (error) {
      return res.status(401).json({ message: "OTP verification failed" });
    }
  }

  // 🔁 RESEND OTP
  static async resend(req, res) {
  try {
    const { tempToken } = req.body;

    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (decoded.purpose !== "OTP_VERIFY") {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ⏱ Cooldown 60s
    if (
      user.otpLastSentAt &&
      Date.now() - user.otpLastSentAt.getTime() < 30 * 1000
    ) {
      const remaining =
        30 -
        Math.floor((Date.now() - user.otpLastSentAt.getTime()) / 1000);

      return res.status(429).json({
        message: `Please wait ${remaining}s before resending OTP`,
      });
    }

    const otp = OtpService.generateOtp();

    user.otpHash = await bcrypt.hash(otp, 10);
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    // 📧 BACKGROUND EMAIL
    setImmediate(() => {
      sendEmail({
        email: user.email,
        subject: "Your Login OTP",
        message: OtpService.generateOTPEmailTemplate(
          otp,
          user.fullName,
          5
        ),
      }).catch(console.error);
    });

    return res.status(200).json({
      message: "OTP resent successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
}

}

module.exports = OtpController;
