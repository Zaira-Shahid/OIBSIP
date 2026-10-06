# Server

Express + Mongoose API. See the [project README](../README.md) for setup and environment variables.

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI
npm run dev            # http://localhost:5000
npm start
```

Health check: `GET /api/health`.
