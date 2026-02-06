const express = require('express');
const router = express.Router();
const VoteController = require('../controllers/voteController');
const protectedKey = require('../middlewares/protectedKey');
const { auth, authorizeRoles } = require('../middlewares/authentication');
const upload = require('../middlewares/fileUploads');

router.get('/votes/', protectedKey, VoteController.getAllVotes);
router.get('/votes/', protectedKey, VoteController.AllVotes);
router.get('/votes/:id', protectedKey, VoteController.getVoteById);
router.post(
  "/votes/",
  upload.single("readMore"),
  VoteController.createVote
);
router.post('/votes/discard/:id', VoteController.discardVoteChanges);
router.put('/votes/bulk-update', VoteController.bulkUpdateSbaPosition);
router.put('/votes/:id', VoteController.updateVote);
router.patch('/votes/status/:id', VoteController.updateVoteStatus);
router.post('/votes/apply-quorum', auth, authorizeRoles("admin"), VoteController.applyQuorumVotes);
router.delete(
  '/votes/:id',
  auth,
  authorizeRoles("admin"),
  VoteController.deleteVote
);

module.exports = router;
