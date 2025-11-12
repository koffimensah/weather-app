const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/weatherdb';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('[RESULT] Connected to MongoDB'))
  .catch(err => console.error('[RESULT] MongoDB error:', err));

// Redis Connection
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.connect()
  .then(() => console.log('[RESULT] Connected to Redis'))
  .catch(err => console.error('[RESULT] Redis error:', err));

// Weather Schema (same as weather service)
const weatherSchema = new mongoose.Schema({
  zipcode: { type: String, required: true },
  city: { type: String, required: true },
  temperature: { type: Number, required: true },
  description: { type: String, required: true },
  windSpeed: { type: Number, required: true },
  humidity: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

weatherSchema.index({ zipcode: 1, timestamp: -1 });
const Weather = mongoose.model('Weather', weatherSchema);

// Get formatted result
app.get('/get/:zipcode', async (req, res) => {
  try {
    const { zipcode } = req.params;

    console.log(`[RESULT] Getting result for zipcode: ${zipcode}`);

    // Check cache first
    const cacheKey = `result:${zipcode}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      console.log(`[RESULT] Returning cached result for ${zipcode}`);
      const result = JSON.parse(cached);
      result.source = 'cache';
      return res.json(result);
    }

    // Get most recent weather data from database
    const weatherData = await Weather.findOne({ zipcode })
      .sort({ timestamp: -1 });

    if (!weatherData) {
      return res.status(404).json({ 
        error: 'No weather data found for this zipcode' 
      });
    }

    // Format result
    const result = {
      zipcode: weatherData.zipcode,
      city: weatherData.city,
      temperature: weatherData.temperature,
      description: weatherData.description,
      windSpeed: weatherData.windSpeed,
      humidity: weatherData.humidity,
      timestamp: weatherData.timestamp,
      source: 'database'
    };

    // Cache for 3 minutes
    await redisClient.setEx(cacheKey, 180, JSON.stringify(result));

    console.log(`[RESULT] Returning formatted result for ${zipcode}`);
    res.json(result);

  } catch (error) {
    console.error('[RESULT] Error:', error);
    res.status(500).json({ error: 'Failed to get result' });
  }
});

// Get history for a zipcode
app.get('/history/:zipcode', async (req, res) => {
  try {
    const { zipcode } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    console.log(`[RESULT] Getting history for zipcode: ${zipcode}`);

    const history = await Weather.find({ zipcode })
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json({ 
      zipcode, 
      count: history.length,
      history 
    });

  } catch (error) {
    console.error('[RESULT] Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'ok',
    service: 'result-service',
    mongodb: mongoStatus,
    redis: redisStatus
  });
});

app.listen(PORT, () => {
  console.log(`[RESULT] Service running on port ${PORT}`);
});