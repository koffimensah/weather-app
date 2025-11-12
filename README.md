# Weather Microservices App

Visual Architecture Overview

┌─────────────────────────────────────────────────────────────┐
│                        USER                                  │
│                    (Web Browser)                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Enters Zipcode (e.g., 10001)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   WEB FRONTEND                               │
│                   React App (Port 3000)                      │
│   • User Interface                                           │
│   • Input zipcode & display weather                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP Request: GET /api/weather/10001
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   API SERVER (Gateway)                       │
│                   Node.js (Port 5000)                        │
│   • Single entry point                                       │
│   • Orchestrates all backend services                        │
└───────────┬──────────────┬──────────────┬───────────────────┘
            │              │              │
     Step 1 │       Step 2 │       Step 3 │
            │              │              │
            ▼              ▼              ▼
┌─────────────────┐ ┌─────────────┐ ┌──────────────┐
│  ZIPCODE        │ │  WEATHER    │ │  RESULT      │
│  SERVICE        │ │  SERVICE    │ │  SERVICE     │
│  Port 3001      │ │  Port 3002  │ │  Port 3003   │
│                 │ │             │ │              │
│ • Validates     │ │ • Fetches   │ │ • Retrieves  │
│   zipcode       │ │   from      │ │   latest     │
│ • Stores in DB  │ │   OpenWeather│ │   weather    │
│ • Caches result │ │ • Saves data│ │ • Formats    │
│                 │ │ • Caches    │ │   response   │
└────────┬────────┘ └──────┬──────┘ └──────┬───────┘
         │                 │                │
         ▼                 ▼                ▼
    ┌────────────────────────────────────────┐
    │         REDIS (Cache Memory)            │
    │            Port 6379                    │
    │  • Stores temporary data                │
    │  • Fast access (in-memory)              │
    │  • Reduces API calls                    │
    └────────────────────────────────────────┘
         │                 │                │
         ▼                 ▼                ▼
    ┌────────────────────────────────────────┐
    │       MongoDB (Database)                │
    │           Port 27017                    │
    │  • Stores zipcodes                      │
    │  • Stores weather history               │
    │  • Persistent storage                   │
    └────────────────────────────────────────┘
                          ▲
                          │
                   ┌──────┴──────┐
                   │ OpenWeather  │
                   │     API      │
                   │  (External)  │
                   └──────────────┘

Step-by-Step Workflow
Phase 1: User Interaction

User opens web browser → Goes to http://localhost:3000
User enters zipcode → Example: "10001" (New York)
User clicks "Get Weather" → Frontend sends request

Phase 2: API Gateway Orchestration

Frontend sends HTTP request to API Server:
GET http://localhost:5000/api/weather/10001

API Server receives request and starts orchestrating:

Logs: "Processing request for zipcode: 10001"
Calls three services sequentially

Phase 3: Service Execution
STEP 1: Zipcode Validation (Port 3001)
API Server → Zipcode Service: "Is 10001 valid?"

Zipcode Service checks:

✓ Is it 5 digits? → YES
✓ Is it numeric? → YES
✓ Check Redis cache → Found? Use cached validation
✗ Not in cache? → Check MongoDB
✗ Not in MongoDB? → Store new zipcode
✓ Cache the validation in Redis (1 hour)

Response: { zipcode: "10001", valid: true }

STEP 2: Weather Data Fetching (Port 3002)
API Server → Weather Service: "Get weather for 10001"
Weather Service checks:

✓ Check Redis cache first → Is there recent data (< 5 min)?

If YES: Return cached data (FAST!)
If NO: Continue to fetch new data



If not cached:

✓ Call OpenWeather API:

  GET https://api.openweathermap.org/data/2.5/weather?zip=10001,US

✓ Receive weather data from OpenWeather:

Result Service:

✓ Check Redis cache → Is there a formatted result (< 3 min)?

If YES: Return cached result
If NO: Query MongoDB for latest weather data


✓ Retrieve from MongoDB:

sql  Find latest weather WHERE zipcode = "10001"
  ORDER BY timestamp DESC

Data Storage Strategy
Redis (Cache) - Short-term Memory

Type: In-memory key-value store
Speed: Extremely fast (milliseconds)
Lifespan: Temporary (minutes to hours)
Purpose: Quick access to frequently requested data

What's cached:

zipcode:10001 → "valid"
weather:10001 → {temp: 72, city: "NY", ...}
result:10001 → {formatted weather data}

MongoDB (Database) - Long-term Memory

Type: Document database (NoSQL)
Speed: Fast (but slower than Redis)
Lifespan: Permanent
Purpose: Historical data and persistence

What's stored:

