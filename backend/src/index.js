require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const peopleRoutes = require('./routes/people');
const projectRoutes = require('./routes/projects');
const allocationRoutes = require('./routes/allocations');
const absenceRoutes = require('./routes/absences');
const teamRoutes = require('./routes/teams');
const roleRoutes = require('./routes/roles');
const holidayRoutes = require('./routes/holidays');
const utilizationRoutes = require('./routes/utilization');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/utilization', utilizationRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Utilization Planner API running on port ${PORT}`);
});

module.exports = app;
