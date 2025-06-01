# Environment Setup Guide

## 🚨 Fix the "supabaseKey is required" Error

You're getting this error because the Supabase environment variables are not configured. Here's how to fix it:

### 1. Create a `.env.local` file in your project root:

```bash
# Copy this template and fill in your actual values
touch .env.local
```

### 2. Add your Supabase credentials to `.env.local`:

```env
# Database Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# AI Configuration (Required for AI features)
OPENAI_API_KEY=sk-your-openai-key-here

# Weather APIs (Optional - for weather data)
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-openweather-key-here
WEATHERAPI_KEY=your-weatherapi-key-here
NEXT_PUBLIC_NOAA_API_KEY=your-noaa-key-here
NEXT_PUBLIC_TIMEZONE_API_KEY=your-timezone-key-here

# Cache Configuration (Optional - for production)
UPSTASH_REDIS_REST_URL=your-redis-url-here
UPSTASH_REDIS_REST_TOKEN=your-redis-token-here

# Backend Service URLs (for development)
AGENT_URL=http://localhost:8002
ROCKETPY_URL=http://localhost:8000
```

### 3. Get your Supabase credentials:

1. Go to [supabase.com](https://supabase.com)
2. Sign in and go to your project dashboard
3. Navigate to Settings → API
4. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Apply your database schema:

```bash
# If you haven't already, apply the database schema
npx supabase db reset

# Or apply specific migrations
npx supabase migration up
```

### 5. Restart your development server:

```bash
# Stop the current server (Ctrl+C) and restart
npm run dev
```

## 🛠️ Optional Setup

### OpenAI API Key (for AI features):
1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to API Keys
3. Create a new secret key
4. Add it as `OPENAI_API_KEY` in your `.env.local`

### Weather API Keys (for real weather data):
1. **OpenWeatherMap**: Sign up at [openweathermap.org](https://openweathermap.org/api)
2. **WeatherAPI**: Sign up at [weatherapi.com](https://www.weatherapi.com/)
3. Add the keys to your `.env.local`

## 🔍 Troubleshooting

### If you still get the error:

1. **Check file name**: Make sure it's `.env.local` (with the dot)
2. **Check location**: The file should be in your project root (same level as `package.json`)
3. **Check syntax**: No spaces around the `=` sign
4. **Restart server**: Always restart after changing environment variables
5. **Check console**: Look for any other error messages

### Test your connection:

Add this to any component to test:

```typescript
import { testDatabaseConnection } from '@/lib/services/database.service';

// Test database connection
useEffect(() => {
  testDatabaseConnection().then(connected => {
    console.log('Database connected:', connected);
  });
}, []);
```

## 🚀 Development vs Production

- **Development**: Use `.env.local` (never commit this file)
- **Production**: Set environment variables in your deployment platform:
  - **Vercel**: Project Settings → Environment Variables
  - **Netlify**: Site Settings → Environment Variables
  - **Railway**: Variables tab in your project

## 📁 File Structure

```
your-project/
├── .env.local          # ← Your environment variables (create this)
├── .env.example        # ← Example template (if it exists)
├── .gitignore          # ← Should include .env.local
├── package.json
└── ...
```

Make sure `.env.local` is in your `.gitignore` file so it doesn't get committed to version control.

---

After following these steps, your app should run without the "supabaseKey is required" error! 🎉 