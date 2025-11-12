import React, { useState } from 'react';
import './App.css';

function App() {
  const [zipcode, setZipcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!zipcode.trim() || zipcode.length !== 5) {
      setError('Please enter a valid 5-digit zipcode');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/weather/${zipcode}`);
      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to fetch weather data');
      }
    } catch (err) {
      setError('Failed to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    
      
        🌤️ Weather Microservices App
        
        
          <input
            type="text"
            placeholder="Enter 5-digit zipcode..."
            value={zipcode}
            onChange={(e) => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 5))}
            className="zipcode-input"
            maxLength="5"
          />
          
            {loading ? 'Loading...' : 'Get Weather'}
          
        

        {error && {error}}

        {result && (
          
            {result.city}
            {Math.round(result.temperature)}°F
            {result.description}
            
            
              
                💨 Wind Speed
                {result.windSpeed} mph
              
              
                💧 Humidity
                {result.humidity}%
              
              
                📍 Zipcode
                {result.zipcode}
              
              
                🕒 Updated
                {new Date(result.timestamp).toLocaleTimeString()}
              
            

            {result.source && (
              
                {result.source === 'cache' ? '⚡ From Cache' : '🌐 Fresh Data'}
              
            )}
          
        )}

        
          How it works:
          
            
              1
              
                Zipcode Service
                Validates and stores zipcode
              
            
            →
            
              2
              
                Weather Service
                Fetches data from OpenWeather API
              
            
            →
            
              3
              
                Result Service
                Returns formatted result with caching
              
            
          
        
      
    
  );
}

export default App;