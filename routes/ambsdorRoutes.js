const express = require('express');
const router = express.Router();
const { createAmbassador, getAllAmbassadors, loginAmbassador, updateAmbassador, deleteAmbassador, getAmbassadorById, getAllUsersByAmbassador, getAllOrdersByAmbassador, getTransactionHistoryAndWalletByAmbassador, getTop10Ambassadors, requestAmbassadorWithdrawal, getAmbassadorWithdrawalRequests, getAllWithdrawalRequests, processAmbassadorWithdrawal, getAllVendorsByAmbassador, getReferredAmbassadorsByAmbassador, capturePayment, getMyPlans, getAmbassadorDashboard } = require('../controllers/ambsdorController');  // Adjust path if needed

// POST request to create a new ambassador
router.post('/create-ambsdor', createAmbassador);
router.get('/allambsdor', getAllAmbassadors);
router.post('/login', loginAmbassador);
router.put('/update-ambsdor/:ambassadorId', updateAmbassador);
router.delete('/delete-ambsdor/:ambassadorId', deleteAmbassador);
router.get('/profile/:ambassadorId', getAmbassadorById);
router.get('/allusers/:ambassadorId', getAllUsersByAmbassador);
router.get('/allvendors/:ambassadorId', getAllVendorsByAmbassador);
router.get('/allambassadors/:ambassadorId', getReferredAmbassadorsByAmbassador);
router.get('/allorders/:ambassadorId', getAllOrdersByAmbassador);
router.get('/alltransactions/:ambassadorId', getTransactionHistoryAndWalletByAmbassador);
router.get('/top10/:ambassadorId', getTop10Ambassadors);
router.post('/withdrawal/:ambassadorId', requestAmbassadorWithdrawal);
router.get('/allwithdrawal/:ambassadorId', getAmbassadorWithdrawalRequests);
router.get('/allwithdrawal', getAllWithdrawalRequests);
router.put('/withdrawals/:withdrawalId', processAmbassadorWithdrawal);
router.post('/pay/:ambassadorId', capturePayment);
router.get('/myplan/:ambassadorId', getMyPlans);
router.get('/mydashboard/:ambassadorId', getAmbassadorDashboard);




module.exports = router;
