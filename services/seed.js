require('dotenv').config();
const mongoose = require('mongoose');
const ModulationScheme = require('./models/Modscheme');

const schemes = [
    {schemeId: 'bpsk', name: 'BPSK', family: 'PSK', displayName: 'BPSK', baseParameters: {bits_per_symbol: 1}},
    {schemeId: 'qpsk', name: 'QPSK', family: 'PSK', displayName: 'QPSK', baseParameters: {bits_per_symbol: 2},
   snr_threshold_db: 6},
    {schemeId: '16qam', name: '16-QAM', family: 'QAM', displayName: '16-QAM', baseParameters: {bits_per_symbol: 4},
   snr_threshold_db: 12},
    {schemeId: '64qam', name: '64-QAM', family: 'QAM', displayName: '64-QAM', baseParameters: {bits_per_symbol: 6}, snr_threshold_db: 18},
    {schemeId: '256qam', name: '256-QAM', family: 'QAM', displayName: '256-QAM', baseParameters: {bits_per_symbol: 8},
   snr_threshold_db: 24},
    {schemeId: '1024qam', name: '1024-QAM', family: 'QAM', displayName: '1024_QAM', baseParameters: {bits_per_symbol: 10},
   snr_threshold_db: 30},    
];

mongoose.connect(process.env.MONGO_URI)
 .then(async () => {
    await ModulationScheme.deleteMany({});
    await ModulationScheme.insertMany(schemes);
    console.log('Modulation schemes seeded!');
    process.exit(0);
 })
 .catch(err => {
    console.error(err);
    process.exit(1);
 })
