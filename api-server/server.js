const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5000;

const ZIPCODE_SERVICE = process.env.ZIPCODE_SERVICE_URL || 'http://localhost:3001';
const WEATHER_SERVICE = process.env.WEATHER_SERVICE_URL || 'http://localhost:3002';
const RESULT_SERVICE = process.env.RESULT_SERVICE_URL || 'http://localhost:3003';

app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Main endpoint - orchestrates all services
app.get('/api/weather/:zipcode', async (req, res) => {
  const { zipcode } = req.params;

  try {
    console.log(`[API] Processing request for zipcode: ${zipcode}`);

    // Step 1: Call Zipcode Service
    console.log('[API] Step 1: Validating zipcode...');
    const zipcodeResponse = await fetch(`${ZIPCODE_SERVICE}/validate/${zipcode}`);
    const zipcodeData = await zipcodeResponse.json();

    if (!zipcodeResponse.ok) {
      return res.status(zipcodeResponse.status).json(zipcodeData);
    }

    // Step 2: Call Weather Service
    console.log('[API] Step 2: Fetching weather data...');
    const weatherResponse = await fetch(`${WEATHER_SERVICE}/fetch/${zipcode}`);
    const weatherData = await weatherResponse.json();

    if (!weatherResponse.ok) {
      return res.status(weatherResponse.status).json(weatherData);
    }

    // Step 3: Call Result Service
    console.log('[API] Step 3: Getting formatted result...');
    const resultResponse = await fetch(`${RESULT_SERVICE}/get/${zipcode}`);
    const resultData = await resultResponse.json();

    if (!resultResponse.ok) {
      return res.status(resultResponse.status).json(resultData);
    }

    console.log(`[API] ✓ Successfully processed request for ${zipcode}`);
    res.json(resultData);

  } catch (error) {
    console.error('[API] Error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'api-server',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[WEATHER] Service running on port ${PORT}`);
});