require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

// Import Routes
const authRoutes   = require('./routes/auth');
const MSRoutes     = require('./routes/modScheme');
const WSRoutes     = require('./routes/workspace');
const simRoutes    = require('./routes/sim');
const ConfigRoutes = require('./routes/configs');

const app = express();

// Middleware — MUST be before routes so req.body is populated
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// Request logger — single next() call
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - body keys: ${Object.keys(req.body || {}).join(', ')}`);
    next();
});

// DB connection
connectDB();

// Routes
app.use('/api/auth',        authRoutes);
app.use('/api/modSchemes',  MSRoutes);
app.use('/api/workspaces',  WSRoutes);
app.use('/api/simulations', simRoutes);
app.use('/api/configs',     ConfigRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});