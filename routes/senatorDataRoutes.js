const express = require('express');
const router = express.Router();
const SenatorDataController = require('../controllers/senatorDataController');
const protectedKey = require('../middlewares/protectedKey');

router.post('/senator-data/', SenatorDataController.createSenatorData);
router.get('/senator-data/', protectedKey, SenatorDataController.getAllSenatorData);
router.get('/senator-data/viewID/:id', protectedKey, SenatorDataController.getSenatorDataById);
router.get('/senator-data/viewbysenator/:id', protectedKey, SenatorDataController.getSenatorDataBySenatorId);
router.put('/senator-data/:id', SenatorDataController.updateSenatorData);
router.delete('/senator-data/:id', SenatorDataController.deleteSenatorData);
router.get(
  "/senators-past-votes/:senateId/",
  protectedKey,
  SenatorDataController.getPastVotesWithDetails
);
router.get(
  "/senator-data/:senatorId",
  protectedKey,
  SenatorDataController.SenatorDataBySenatorId
);
router.post(
  "/bulk-publish",protectedKey,
  protectedKey,
  SenatorDataController.bulkPublish
);
module.exports = router;
