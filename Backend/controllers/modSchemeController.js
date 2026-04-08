const ModulationScheme = require('../models/Modscheme');

//block to get all the possible schemes from the database
exports.getAllSchemes = async (req, res) => {
    try {
        const schemes = await ModulationScheme.find().lean();
        res.json(schemes);
    } catch (err) {
        res.status(500).json({message: 'Server error'});
    }
};

//block to get scheme from a specific simulation
exports.getSchemeById = async (req, res) => {
    try {
        const scheme = await ModulationScheme.findById(req.params.id);
        if (!scheme) return res.status(404).json({message: 'Scheme not found'});
        res.json(scheme);
    } catch (err) {
        res.status(500).json({message: 'Server error'
        });
    }
};