const {Router} = require('express');
const {imprimirPost} = require('../controllers/imprimir');

const router = Router();


router.post('/', imprimirPost);


module.exports = router;