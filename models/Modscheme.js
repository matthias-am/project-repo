const mongoose = require('mongoose'); //implement mongoose library

const modSchemeSchema = new mongoose.Schema ({
    schemeId: { 
        type: String,
         required: true, 
         unique: true
        },

    name: {
        type: String, 
        required: true
    },

    family: {
        type: String, 
        enum: ['PSK', 'QAM', 'OFDM', 'FSK'], 
        required: true
    },

    displayName: { 
        type: String, //"QPSK""64QAM" etc
        required: true
    }, 
    
    baseParameters: {
        type: mongoose.Schema.Types.Mixed, 
        default: {} //bits per symbol: 2, phase offset: 0
    },

    requiredParamNames: { 
        type: [String], 
        default: ['symbol_rate', 'snr_min'] //FIND OUT IF TO ADD SNR_MAC
    }, 
    
    createdAt: {
        type: Date,
         default: Date.now
        },

});

module.exports = mongoose.model('ModScheme', modSchemeSchema);
