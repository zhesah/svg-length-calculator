var express = require('express');
var router = express.Router();
var util = require("util"); 
var length_calculator = require('/Users/Jeremy/Length_Calculator/helper_methods/length_calculator');
var fs = require("fs");

/* GET calculator page page. */
router.get('/', function(req, res, next) {
  	res.render('calculator', { title: 'Laser Cutter Calculator' });
});

router.post("/upload", function(req, res, next){ 
	if (req.file) { 
		console.log(util.inspect(req.file));
		if (req.file.size === 0) {
		    return next(new Error("Please select a file."));
		}
		fs.exists(req.file.path, function(exists) { 
			if(exists) { 
				location = '/'+req.file.path;
				console.log(location);
				var data = length_calculator.getCost(req.body.material, location, req.body.membership);
				res.render('data', {
					title: 'Results',
					material: req.body.material,
					membership: req.body.membership,
					pathLength: data.pathLength.toFixed(2),
					jogLength: data.jogLength.toFixed(2),
					time: data.time.toFixed(2),
					cost: data.money.toFixed(2)
				}); 
			} else { 
				res.end("Error. File not found."); 
			} 
		}); 
	}
});

module.exports = router;