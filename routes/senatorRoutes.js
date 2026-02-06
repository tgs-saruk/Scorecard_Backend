const express = require('express');
const router = express.Router();
const SenatorController = require('../controllers/senatorController');
const upload = require('../middlewares/fileUploads');
const protectedKey = require('../middlewares/protectedKey');
const { auth, authorizeRoles } = require('../middlewares/authentication');

router.post('/senators/', (req, res, next) => {
    req.query.type = 'senator';
    next();
}, upload.single('photo'), SenatorController.createSenator);

router.post('/senators/discard/:id', SenatorController.discardSenatorChanges);
router.get('/senators/', protectedKey, SenatorController.getAllSenators);
router.get('/senators/:id', protectedKey, SenatorController.getSenatorById);
router.put('/senators/update/:id', upload.single('photo'), SenatorController.updateSenator);
router.put("/senators/status/:id", SenatorController.updateSenatorStatus);
router.delete('/senators/:id', auth, authorizeRoles("admin"), SenatorController.deleteSenator);
router.get('/senators/', protectedKey, SenatorController.Senators);
router.get('/senators/:id', protectedKey, SenatorController.SenatorById);


module.exports = router;
