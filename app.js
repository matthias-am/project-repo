require ('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

//Import Routes
const authRoutes = require('./routes/auth');
console.log('Auth routes loaded:')
const MSRoutes = require('./routes/modScheme');
console.log('MS routes loaded:')
const WSRoutes = require('./routes/workspace'
);
const simRoutes = require('./routes/sim');


const app = express();

// Log EVERY incoming request - place this near the top of app.js
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

//code for Middleware
app.use(express.json({limit: '1mb'}));
app.use(cors());

//DB connection
connectDB();


//Authorization Route
app.use('/api/auth', authRoutes);
app.use('/api/modSchemes', MSRoutes );

app.use('/api/workspaces', WSRoutes);
app.use('/api/simulations', simRoutes);
//status code 404 handler
app.use((req, res)=>{
    res.status(404).json({message: 'Route not found'});
});

//Code for server start
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running ${process.env.NODE_ENV} mode on port ${PORT}`);
})