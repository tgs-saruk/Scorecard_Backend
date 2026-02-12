const express = require('express');
const router = express.Router();
const HD = require('../controllers/representativeData');
const protectedKey = require('../middlewares/protectedKey');

router.post('/admin/house-data/', HD.createHouseData);
router.get('/admin/house-data/', protectedKey, HD.getAllHouseData);
router.get('/admin/house-data/viewID/:id', protectedKey, HD.getHouseDataById);
router.get('/admin/house-data/viewbyhouse/:id', protectedKey, HD.getHouseDataByHouseId);
router.put('/admin/house-data/:id', HD.updateHouseData);
router.put('/admin/house-data/scores/update', HD.updateScores);
router.delete('/admin/house-data/:id', HD.deleteHouseData);
router.get('/house-data/:repId', protectedKey, HD.HouseDataByHouseId);
router.post('/admin/house-data/bulk-publish', HD.bulkPublish);

module.exports = router;
