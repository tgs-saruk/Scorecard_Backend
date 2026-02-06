const express = require('express');
const router = express.Router();
const RC = require('../controllers/representativeController');
const upload = require('../middlewares/fileUploads');
const protectedKey = require('../middlewares/protectedKey');
const { auth, authorizeRoles } = require('../middlewares/authentication');

router.post('/houses/', (req, res, next) => {
    req.query.type = 'house';
    next();
}, upload.single('photo'), RC.createHouse);

router.post('/houses/discard/:id', RC.discardHouseChanges);
router.get('/houses/', protectedKey, RC.getAllHouse);
router.get('/houses/:id', protectedKey, RC.getHouseById);
router.put('/houses/update/:id', (req, res, next) => {
    req.query.type = 'house';
    next();
}, upload.single('photo'), RC.updateHouse);
router.patch("/houses/status/:id", RC.updateRepresentativeStatus);
router.delete('/houses/:id', auth, authorizeRoles("admin"), RC.deleteHouse);
router.get('/houses/', protectedKey, RC.AllHouse);
router.get('/houses/:id', protectedKey, RC.HouseById);

module.exports = router;
