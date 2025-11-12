const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/weatherdb';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const API_KEY = process.env.OPENWEATHER_API_KEY;

app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('[WEATHER] Connected to MongoDB'))
  .catch(err => console.error('[WEATHER] MongoDB error:', err));

// Redis Connection
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.connect()
  .then(() => console.log('[WEATHER] Connected to Redis'))
  .catch(err => console.error('[WEATHER] Redis error:', err));

// Weather Schema
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

// Fetch weather data
app.get('/fetch/:zipcode', async (req, res) => {
  try {
    const { zipcode } = req.params;

    console.log(`[WEATHER] Fetching weather for zipcode: ${zipcode}`);

    if (!API_KEY) {
      return res.status(500).json({ error: 'Weather API key not configured' });
    }

    // Check cache first (5 minutes)
    const cacheKey = `weather:${zipcode}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      console.log(`[WEATHER] Returning cached data for ${zipcode}`);
      return res.json(JSON.parse(cached));
    }

    // Fetch from OpenWeather API
    const url = `https://api.openweathermap.org/data/2.5/weather?zip=${zipcode},US&appid=${API_KEY}&units=imperial`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || 'Failed to fetch weather data' 
      });
    }

    // Prepare weather data
    const weatherData = {
      zipcode,
      city: data.name,
      temperature: data.main.temp,
      description: data.weather[0].description,
      windSpeed: data.wind.speed,
      humidity: data.main.humidity,
      timestamp: new Date()
    };

    // Save to MongoDB
    const weather = new Weather(weatherData);
    await weather.save();
    console.log(`[WEATHER] Saved weather data for ${zipcode}`);

    // Cache for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(weatherData));

    res.json(weatherData);

  } catch (error) {
    console.error('[WEATHER] Error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'ok',
    service: 'weather-service',
    mongodb: mongoStatus,
    redis: redisStatus,
    apiKey: API_KEY ? 'configured' : 'missing'
  });
});

app.listen(PORT, () => {
  console.log(`[WEATHER] Service running on port ${PORT}`);
});