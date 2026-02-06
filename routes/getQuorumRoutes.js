const express = require("express");
const router = express.Router();
const QuorumDataController = require("../controllers/getQuorumDataController");
const FormerMembersController = require("../controllers/FormerMembersController");
const { saveData, saveBills, getDataStatus } = QuorumDataController;
const protectedKey = require("../middlewares/protectedKey");
const { auth, authorizeRoles } = require("../middlewares/authentication");

// Initialize FormerMembersController with QuorumDataController instance
const formerMembersController = new FormerMembersController(
  QuorumDataController
);

router.post("/store-data", auth, authorizeRoles("admin"), saveData);
router.post("/votes/save", saveBills);
router.get("/status/:type", protectedKey, getDataStatus);
router.get(
  "/former",

  async (req, res) => {
    const { type } = req.query;

    if (!type || !["senator", "representative"].includes(type.toLowerCase())) {
      return res.status(400).json({
        error: "Invalid type",
        message:
          "Query param ?type=senator or ?type=representative is required",
      });
    }

    try {
      await formerMembersController.saveFormerMembersByType(
        type.toLowerCase(),
        req,
        res
      );
    } catch (err) {
      console.error("Former fetch error:", err.message);
      res.status(500).json({
        error: "Failed to fetch former members",
        message: err.message,
      });
    }
  }
);

router.post("/save-former", auth, authorizeRoles("admin"), async (req, res) => {
  const { type } = req.body;

  if (!type || !["senator", "representative"].includes(type.toLowerCase())) {
    return res.status(400).json({
      error: "Invalid type",
      message: "Body param type=senator or type=representative is required",
    });
  }

  try {
    await formerMembersController.saveFomerMembersToDatabase(req, res);
  } catch (err) {
    console.error("Save former members error:", err.message);
    res.status(500).json({
      error: "Failed to save former members",
      message: err.message,
    });
  }
});

module.exports = router;
