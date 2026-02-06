const express = require('express');
const router = express.Router();
const AC = require('../controllers/activityController');
const protectedKey = require('../middlewares/protectedKey');
const upload = require('../middlewares/fileUploads');

router.get('/activities/', protectedKey, AC.getAllActivities);
router.get('/activities/', protectedKey, AC.AllActivity);
router.get('/activities/:id', protectedKey, AC.getActivityById);
router.post("/activities/save", AC.saveActivityFromBill);
router.post('/activities/populate-sponsors', AC.populateSponsorsForBills);
router.post("/activities/", upload.single("readMore"), AC.createActivity);
router.post('/activities/discard/:id', AC.discardActivityChanges);
router.put('/activities/update-track-activities', AC.bulkUpdateTrackActivities);
router.put('/activities/status/:id', AC.updateActivityStatus);
router.put('/activities/:id', AC.updateActivity);
router.delete('/activities/:id', AC.deleteActivity);

module.exports = router;
 