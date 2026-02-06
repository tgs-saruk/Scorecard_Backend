const express = require('express');
const router = express.Router();
const HD = require('../controllers/representativeData');
const protectedKey = require('../middlewares/protectedKey');

router.post('/house-data/', HD.createHouseData);
router.get('/house-data/', protectedKey, HD.getAllHouseData);
router.get('/house-data/viewID/:id', protectedKey, HD.getHouseDataById);
router.get('/house-data/viewbyhouse/:id', protectedKey, HD.getHouseDataByHouseId);
router.put('/house-data/:id', HD.updateHouseData);
router.put('/house-data/scores/update', HD.updateScores);
router.delete('/house-data/:id', HD.deleteHouseData);
router.get('/house-data/:repId', protectedKey, HD.HouseDataByHouseId);
router.post('/house-data/bulk-publish', HD.bulkPublish);

module.exports = router;
