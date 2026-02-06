const express = require("express");
const router = express.Router();
const OtpController = require("../controllers/otpController");

router.post("/verify-otp", OtpController.verify);
router.post("/resend-otp", OtpController.resend);

module.exports = router;
