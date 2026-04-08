const bcrypt = require('bcryptjs'); //bycryptjs library to securely hash passwords
const jwt = require('jsonwebtoken'); //library that creates and verifies JWT 
const { validationResult } = require('express-validator'); //checks for validation errors from middleware before
const User = require('../models/User'); //require  user schema model in folder models
const Workspace = require('../models/Workspace');


// function to register a new user
exports.register = async (req, res) => {
    const errors = validationResult(req); //check for validtion errors from middleware
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() }); //returns all validation error messages in an array, cause 400 is bad request
    }


    const { username, email, password } = req.body; //array components is the required body

    //mini block for debugging
    //console.log('User data before save:', req.body);

    const user = new User(req.body);

    //console.log('Mongoose document:', user.toObject());

    //block for email that already exists
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' }); //returns this message is email is found in Database
        }
        user = new User({ username, email, password }); //create new user

        //Hash Password
        const salt = await bcrypt.genSalt(10); //generates random
        user.password = await bcrypt.hash(password, salt); //combo of hash and salt



        await user.save(); //Saves to database

        //create a default workspace for user
        const workspace = await Workspace.create({
            name: 'My Workspace',
            owner: user._id,
        });


        //Checks if JWT_ST works
        if (!process.env.JWT_ST) {
            console.error('JWT_ST is missing!');
            return res.status(500).json({ message: 'Server configuration error - missing JWT secret' });
        }

        //Create Java Web Token paylord
        const upayload = { userId: user._id };


        const token = jwt.sign(upayload, process.env.JWT_ST, { //key from env
            expiresIn: '7d',
        }); //token valid for 7 days

        res.status(201).json({
            token,
            user: {
                id: user._id,
                Username: user.username,
                email: user.email,
            }, //web token string
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' }); //error catcher for server errors
    }
};

//existing user block
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email }).select('+password'); //Finds user by email, requiring pw field
        if (!user) {
            await new Promise(resolve => setTimeout(resolve, 800));
            return res.status(400).json({ message: 'Invalid Credentials' }); //error code if no match found
        }
        const isMatch = await bcrypt.compare(password, user.password); //compares request password against the stored hash
        if (!isMatch) {
            await new Promise(resolve => setTimeout(resolve, 800));
            return res.status(400).json({ message: 'Invalid credentials' }); //error message if no match is found
        }

        //same code below as above

        const upayload = { userId: user._id };
        const token = jwt.sign(upayload, process.env.JWT_ST, {
            expiresIn: '7d',
        });

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (err) {
        console.error('Login error: ', err);
        res.status(500).json({ message: 'Server error' });
    }
};

