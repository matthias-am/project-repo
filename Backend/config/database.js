const mongoose = require('mongoose'); //imports Mongoose Library

//code for mongoDB connection
const connectDB =async() => { //async cause await
    try{
        await mongoose.connect(process.env.MONGO_URI); //connects to MongoDB and reads the connection string from .env
        console.log('MongoDB connected successfully');
    }
    catch (err) { // displays error msg when cant connect and exits
        console.error('MongoDB connection error: ', err.message);
        process.exit(1)
    } 
};
module.exports = connectDB; //exports this file for use in another file