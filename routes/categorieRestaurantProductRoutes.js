const express = require("express");
const router = express.Router();
const upload = require('../utils/multer');
const controller = require("../controllers/categorieRestaurantProductController");

router.post("/categorieProduct", upload.single("image"), controller.createCategorieRestaurantProduct);
router.get("/categorieProducts", controller.getAllCategorieRestaurantProducts);
router.get("/categorieProduct/:id", controller.getCategorieRestaurantProductById);
router.put("/categorieProduct/:id", upload.single("image"), controller.updateCategorieRestaurantProduct);
router.delete("/categorieProduct/:id", controller.deleteCategorieRestaurantProduct);
router.get("/bycategorie/:categorieId", controller.getByCategorieId);

module.exports = router;
