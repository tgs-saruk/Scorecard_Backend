const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/userSchema");
const JWT_SECRET = process.env.JWT_SECRET;
const OtpService  = require('../helper/otpService');
const sendEmail = require("../config/send-email");
class userController {
  static async createUser(req, res) {
    try {
      const { fullName, nickName, email, password, role } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({
        fullName,
        nickName,
        email,
        password: hashedPassword,
        role,
      });
      await newUser.save();
      res
        .status(201)
        .json({ message: "User created successfully", user: newUser });
    } catch (error) {
      res.status(400).json({ message: "Error creating user", error });
    }
  }
  // Get a user by ID
  static async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json(user);
    } catch (error) {
      res.status(400).json({ message: "Error fetching user", error });
    }
  }
  // Update user details
  static async updateUser(req, res) {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res
        .status(200)
        .json({ message: "User updated successfully", user: updatedUser });
    } catch (error) {
      res.status(400).json({ message: "Error updating user", error });
    }
  }
  // Delete a user
  static async deleteUser(req, res) {
    try {
      const deletedUser = await User.findByIdAndDelete(req.params.id);
      if (!deletedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: "Error deleting user", error });
    }
  }
  // Login a user
  // static async loginUser(req, res) {
  //   try {
  //     const { email, password } = req.body;
  //     const user = await User.findOne({ email });
  //     if (!user) {
  //       return res.status(404).json({ message: 'User not found' });
  //     }
  //     const isMatch = await bcrypt.compare(password, user.password);
  //     if (!isMatch) {
  //       return res.status(400).json({ message: 'Invalid credentials' });
  //     }
  //   const token = jwt.sign(
  //       {
  //         id: user._id,

  //         role: user.role,

  //       },
  //       process.env.JWT_SECRET,
  //       { expiresIn: "30d" }
  //     );
  //     res.status(200).json({
  //       message: 'Login successful',
  //       token,
  //       user: { id: user._id, fullName: user.fullName, nickName: user.nickName, role: user.role }
  //     });
  //   } catch (error) {
  //     res.status(500).json({ message: 'Error logging in', error });
  //   }
  // }
  //   static async loginUser(req, res) {
  //   try {
  //     const { email, password } = req.body;

  //     const user = await User.findOne({ email });
  //     if (!user) {
  //       return res.status(404).json({ message: "User not found" });
  //     }

  //     const isMatch = await bcrypt.compare(password, user.password);
  //     if (!isMatch) {
  //       return res.status(400).json({ message: "Invalid credentials" });
  //     }

  //     // 🔐 Generate OTP
  //     const otp = generateOtp();
  //     const otpHash = await bcrypt.hash(otp, 10);

  //     user.otpHash = otpHash;
  //     user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
  //     await user.save();

  //     // 📧 Send OTP email (pseudo – plug your mailer)
  //     console.log("OTP:", otp); // REMOVE in production

  //     /**
  //      * TODO:
  //      * sendEmail({
  //      *   to: user.email,
  //      *   subject: "Your Login OTP",
  //      *   text: `Your OTP is ${otp}`
  //      * })
  //      */

  //     // Temporary token (not JWT)
  //     const tempToken = jwt.sign(
  //       { id: user._id, purpose: "OTP_VERIFY" },
  //       JWT_SECRET,
  //       { expiresIn: "10m" }
  //     );

  //     res.status(200).json({
  //       message: "OTP sent to email",
  //       tempToken,
  //     });
  //   } catch (error) {
  //     res.status(500).json({ message: "Login error", error });
  //   }
  // }
//   static async loginUser(req, res) {
//     try {
//       const { email, password } = req.body;

//       // 1️⃣ Check user
//       const user = await User.findOne({ email });
//       if (!user) {
//         return res.status(404).json({ message: "User not found" });
//       }

//       // 2️⃣ Check password
//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) {
//         return res.status(400).json({ message: "Invalid credentials" });
//       }

//       // 3️⃣ Generate OTP
//       const otp = generateOtp();
//       user.otpHash = await bcrypt.hash(otp, 10);
//       user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
//       user.otpAttempts = 0;
//       user.otpLastSentAt = new Date();
//       await user.save();

//       // 4️⃣ Send OTP Email (USING YOUR MAILER ✅)
//       await sendEmail({
//         email: user.email,
//         subject: "Your Scorecard Admin Login OTP",
//         message: `
// Hello ${user.fullName},

// Your One-Time Password (OTP) for logging into Scorecard Admin is:

// 🔐 ${otp}

// This OTP is valid for 5 minutes.
// Do not share this code with anyone.

// If you did not attempt to log in, please ignore this email.

// — Scorecard Admin Team
//       `,
//       });

//       // 5️⃣ Create TEMP token (NOT JWT)
//       const tempToken = jwt.sign(
//         { id: user._id, purpose: "OTP_VERIFY" },
//         JWT_SECRET,
//         { expiresIn: "10m" },
//       );

//       return res.status(200).json({
//         message: "OTP sent to your email",
//         tempToken,
//       });
//     } catch (error) {
//       console.error("Login error:", error);
//       return res.status(500).json({ message: "Login error" });
//     }
//   }
// static async loginUser(req, res) {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }

//     // 🔐 OTP
//     const otp = OtpService.generateOtp();

//     user.otpHash = await bcrypt.hash(otp, 10);
//     user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
//     user.otpAttempts = 0;
//     user.otpLastSentAt = new Date();
//     await user.save();

//     // 📧 SEND MAIL IN BACKGROUND (🔥)
//     setImmediate(() => {
//       sendEmail({
//         email: user.email,
//         subject: "Your Scorecard Admin Login OTP",
//         message: OtpService.generateOTPEmailTemplate(
//           otp,
//           user.fullName,
//           5
//         ),
//       }).catch(console.error);
//     });

//     const tempToken = jwt.sign(
//       { id: user._id, purpose: "OTP_VERIFY" },
//       JWT_SECRET,
//       { expiresIn: "10m" }
//     );

//     return res.status(200).json({
//       message: "OTP sent successfully",
//       tempToken,
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     return res.status(500).json({ message: "Login error" });
//   }
// }
static async loginUser(req, res) {
  try {
    const { email, password } = req.body;

    // 1️⃣ Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    /**
     * 3️⃣ FORCE 2FA SETUP IF NOT ENABLED
     */
    if (!user.twoFactorEnabled) {
      const setupToken = jwt.sign(
        {
          id: user._id,
          purpose: "TWO_FACTOR_SETUP",
        },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );

      return res.status(200).json({
        requires2FASetup: true,
        tempToken: setupToken,
        message: "Two-factor authentication setup required",
      });
    }

    /**
     * 4️⃣ IF 2FA ENABLED → REQUIRE AUTHENTICATOR CODE
     */
    const verifyToken = jwt.sign(
      {
        id: user._id,
        purpose: "TWO_FACTOR_VERIFY",
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    return res.status(200).json({
      requires2FA: true,
      tempToken: verifyToken,
      message: "Enter code from your Authenticator app",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login error" });
  }
}

  // static async verifyOtp(req, res) {
  //   try {
  //     const { otp, tempToken } = req.body;

  //     if (!otp || !tempToken) {
  //       return res.status(400).json({ message: "OTP required" });
  //     }

  //     const decoded = jwt.verify(tempToken, JWT_SECRET);
  //     if (decoded.purpose !== "OTP_VERIFY") {
  //       return res.status(401).json({ message: "Invalid token" });
  //     }

  //     const user = await User.findById(decoded.id);
  //     if (!user || !user.otpHash) {
  //       return res.status(400).json({ message: "OTP not found" });
  //     }

  //     if (user.otpExpiry < new Date()) {
  //       return res.status(400).json({ message: "OTP expired" });
  //     }

  //     const isOtpValid = await bcrypt.compare(otp, user.otpHash);
  //     if (!isOtpValid) {
  //       return res.status(400).json({ message: "Invalid OTP" });
  //     }

  //     // ✅ Clear OTP after success
  //     user.otpHash = null;
  //     user.otpExpiry = null;
  //     await user.save();

  //     // 🔐 FINAL JWT
  //     const token = jwt.sign(
  //       {
  //         id: user._id,
  //         role: user.role,
  //       },
  //       JWT_SECRET,
  //       { expiresIn: "30d" },
  //     );

  //     res.status(200).json({
  //       token,
  //       user: {
  //         id: user._id,
  //         fullName: user.fullName,
  //         nickName: user.nickName,
  //         role: user.role,
  //       },
  //     });
  //   } catch (error) {
  //     res.status(401).json({ message: "OTP verification failed", error });
  //   }
  // }

  static async assignUserRole(req, res) {
    try {
      const { userId, newRole } = req.body;
      const validRoles = ["admin", "editor", "contributor"];
      if (!validRoles.includes(newRole)) {
        return res.status(400).json({ message: "Invalid role provided." });
      }
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      user.role = newRole;
      await user.save();
      res.status(200).json({
        message: `Role updated to ${newRole}`,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error assigning role", error: error.message });
    }
  }

  static async getAllUsers(req, res) {
    try {
      const users = await User.find({}, "-password");
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: "Error fetching users", error });
    }
  }
}

module.exports = userController;
