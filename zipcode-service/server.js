const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/weatherdb';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('[ZIPCODE] Connected to MongoDB'))
  .catch(err => console.error('[ZIPCODE] MongoDB error:', err));

// Redis Connection
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.connect()
  .then(() => console.log('[ZIPCODE] Connected to Redis'))
  .catch(err => console.error('[ZIPCODE] Redis error:', err));

// Zipcode Schema
const zipcodeSchema = new mongoose.Schema({
  zipcode: { type: String, required: true, unique: true },
  isValid: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Zipcode = mongoose.model('Zipcode', zipcodeSchema);

// Validate and store zipcode
app.get('/validate/:zipcode', async (req, res) => {
  try {
    const { zipcode } = req.params;

    console.log(`[ZIPCODE] Validating zipcode: ${zipcode}`);

    // Basic validation
    if (!zipcode || zipcode.length !== 5 || !/^\d{5}$/.test(zipcode)) {
      return res.status(400).json({ error: 'Invalid zipcode format. Must be 5 digits.' });
    }

    // Check cache first
    const cached = await redisClient.get(`zipcode:${zipcode}`);
    if (cached) {
      console.log(`[ZIPCODE] Found in cache: ${zipcode}`);
      return res.json({ zipcode, valid: true, source: 'cache' });
    }

    // Check or store in database
    let zipcodeDoc = await Zipcode.findOne({ zipcode });
    if (!zipcodeDoc) {
      zipcodeDoc = new Zipcode({ zipcode, isValid: true });
      await zipcodeDoc.save();
      console.log(`[ZIPCODE] Stored new zipcode: ${zipcode}`);
    }

    // Cache for 1 hour
    await redisClient.setEx(`zipcode:${zipcode}`, 3600, 'valid');

    res.json({ zipcode, valid: true, source: 'database' });

  } catch (error) {
    console.error('[ZIPCODE] Error:', error);
    res.status(500).json({ error: 'Failed to validate zipcode' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'ok',
    service: 'zipcode-service',
    mongodb: mongoStatus,
    redis: redisStatus
  });
});

app.listen(PORT, () => {
  console.log(`[ZIPCODE] Service running on port ${PORT}`);
});