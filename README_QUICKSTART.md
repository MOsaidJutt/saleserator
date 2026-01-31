# Saleserator – Ready to Run

## Backend
1. `cd backend`
2. `npm install`
3. Create `.env` (see `.env.example` if present):
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=saleserator
PORT=5000
JWT_SECRET=supersecret_dev_change_me
```
4. `node app.js`

## Frontend
1. `cd frontend`
2. `npm install`
3. Create `.env`:
```
REACT_APP_API_URL=http://localhost:5000
```
4. `npm start`
