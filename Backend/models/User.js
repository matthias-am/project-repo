const mongoose = require('mongoose');

//Schema Creation with the entities and their definitions
const userSchema = new mongoose.Schema({

    //figure out what you wanna do for userID, can use mongoDB object ID or set string-based customs but research more on that

    //username attribute
  username: {
    type: String,
    required: [true, 'Username is required'], //this mismatch caused error, ensure name of attribute and what is mentioned here match
    unique: true,
    trim: true, //no white space before or after
    minlength: [5, 'Username must be at least 5 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^\S+$/, 'Username cannot contain spaces'],  // /^\S no spaces and $/ lowercase: true, 
  },


    //Email attribute
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true, //no white space before or after
        match: [
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/, //standard email code apparently, 
            // ^ prevents spaces or junk before email
            //[^\s@] means one or more chars that are NOt space or @
            //@ means @, literally
            //\., actual dot for the .com
            //$ means end of string so nun else allowed
            'Please use a valid email address',
        ],
        
    },

    //Password attribute
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be atleast 8 characters'],
        select: false, //dont return the user's pw in queries
    },

    created_at: {
        type: Date,
        default: Date.now,
        immutable: true, //cant be changed
    },

    last_login: {
        type: Date,
        default: null, //for new users
    },

}, {
    timestamps: false, //created_at is managed manually so no automatic timestamps needed
    versionKey: false,

});

//block to update last login
userSchema.methods.updateLastLogin = async function () {
    this.last_login = new Date ();
    await this.save ({validateBeforeSave: false});
};

module.exports = mongoose.model('users', userSchema); //turns userSchema into usable model