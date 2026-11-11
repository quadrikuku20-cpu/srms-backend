# SRMS Backend: Smart Restaurant Management System API

SODV2201 Web Programming, Assignment 2 (also the backend half of the Final Project).

A REST API built with **Node.js, Express and MongoDB (Mongoose)**. It handles users and login, the menu, orders, table reservations, special events and a simulated AI chat assistant. The React frontend lives in a separate repo: **srms-frontend**.

- **Live API:** https://srms-backend-ampl.onrender.com (health check: `/api/health`)
- **Live site (frontend):** https://srms-frontend-six.vercel.app
- **Frontend repo:** https://github.com/quadrikuku20-cpu/srms-frontend

> The live API runs on a free Render instance. After about 15 minutes without traffic it goes to sleep, and the first request afterwards can take around a minute. Open `/api/health` first and wait for `{"status":"ok"}`.

## Tech stack

- Node.js with ES modules (`"type": "module"`)
- Express 5
- MongoDB Atlas with Mongoose 9
- JSON Web Tokens (`jsonwebtoken`) for login sessions
- `bcryptjs` for password hashing
- `express-validator` for input validation
- `cors`, `morgan` (request logging), `dotenv`
- `helmet` (security headers) and `express-rate-limit` (limits repeated failed logins)

## Run it locally

You need Node.js and a MongoDB connection string (a free MongoDB Atlas cluster works).

```bash
git clone https://github.com/quadrikuku20-cpu/srms-backend.git
cd srms-backend
npm install
```

Create a file named `.env` in this folder, using `.env.example` as the template:

```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/srms?appName=<appname>
JWT_SECRET=<a long random string>
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
```

Notes on the values:

- `MONGO_URI` must include the database name (`/srms`) before the `?`. If your password contains symbols such as `#`, `@`, `/` or `:`, either choose a letters-and-numbers password or URL-encode it.
- In Atlas, Network Access must allow your IP address (or `0.0.0.0/0` while developing).
- `JWT_SECRET` should be a long random string, for example generated with the Node crypto module (`randomBytes(48)`). Never commit your `.env` file.
- `CLIENT_ORIGIN` is the only website allowed to call the API (CORS). It must match the frontend's address exactly, with no trailing slash.

Fill the database with demo data, then start the server:

```bash
npm run seed    # creates the demo users and 10 menu items
npm run dev     # starts on http://localhost:5000 with auto-restart
```

Other scripts: `npm start` runs the server once without auto-restart.

Check that it works by opening http://localhost:5000/api/health, which should return `{"status":"ok"}`, and http://localhost:5000/api/menu, which should return the dishes.

## Demo accounts (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@srms.local | admin123 |
| Customer | customer@srms.local | customer123 |

These are for demonstration only. New accounts created through `/api/auth/register` are always customers; admin accounts can only be created through the seed script or directly in the database.

## API overview

All routes start with `/api`. Protected routes expect the header `Authorization: Bearer <token>`, where the token comes from login or register.

| Area | Endpoint | Who can use it |
|---|---|---|
| Health | `GET /health` | Anyone |
| Auth | `POST /auth/register` | Anyone |
| | `POST /auth/login` | Anyone |
| | `GET /auth/me` | Logged-in user |
| Users | `GET /users` | Admin |
| | `GET /users/:id`, `PUT /users/:id` | The user themselves, or admin |
| | `DELETE /users/:id` | Admin |
| Menu | `GET /menu`, `GET /menu/:id` | Anyone |
| | `POST /menu`, `PUT /menu/:id`, `DELETE /menu/:id` | Admin |
| Orders | `POST /orders` | Logged-in user |
| | `GET /orders`, `GET /orders/:id` | Own orders (admin sees all) |
| | `PUT /orders/:id/cancel` | Order owner or admin |
| | `PUT /orders/:id/status` | Admin |
| Reservations | `POST /reservations` | Logged-in user |
| | `GET /reservations` | Own reservations (admin sees all) |
| | `PUT /reservations/:id`, `DELETE /reservations/:id` | Owner or admin |
| | `PUT /reservations/:id/status` | Admin |
| Events | `POST /events` | Logged-in user |
| | `GET /events` | Own events (admin sees all) |
| | `DELETE /events/:id` | Owner or admin |
| | `PUT /events/:id/status` | Admin |
| Chatbot | `POST /chatbot` | Anyone (personalised if a token is sent) |
| Stats | `GET /stats` | Admin (revenue, orders per day, top dishes, counts) |

`GET /menu` accepts the query parameters `category`, `dietary`, `search`, `maxPrice` and `includeUnavailable` (only admins see unavailable dishes, even if the parameter is sent).

Request details worth knowing:

- `POST /reservations` takes `date`, `time`, `partySize`, an optional `reservationType` (`dining`, `birthday`, `anniversary`, `business` or `other`) and optional `specialRequests`.
- `POST /events` takes `eventType`, `date`, `time`, `guestCount` (1 to 100), an optional `menuSelection` (a list of menu item ids, each checked against the menu) and optional `additionalRequirements`.
- `PUT /users/:id` updates `name` and `preferences` (`favoriteCategory` and `dietaryRestrictions`), which are validated.

## How the main features work

**Authentication and roles.** Passwords are hashed with bcrypt before they are saved. Login returns a JWT. The `protect` middleware checks the token on every protected route, and `requireRole("admin")` restricts admin-only routes. Customers can only see and change their own orders, reservations and events.

**Order pricing.** The browser only sends dish IDs and quantities. The server looks up the current prices in the database and calculates the total itself, so prices cannot be tampered with from the client. Each order stores a snapshot of the dish name and price at the time it was placed. Customers can cancel an order only while it is pending; admins can cancel any order that has not been delivered.

**Reservations and double-booking.** Reservations are checked against the opening hours (11:00 to 22:00) and must be in the future (compared in Calgary time). Each reservation has a type. Customers can edit a reservation; if the date or time changes, the server finds a free table for the new slot, and cancelled reservations cannot be edited. If no table is requested, the server assigns the first free one out of 15. A unique database index on date, time and table number (ignoring cancelled reservations) prevents two active bookings for the same table at the same time, even if two requests arrive together.

**Validation and errors.** Every write route validates its input with `express-validator`. A shared error handler turns Mongoose validation errors, duplicate-key errors and bad IDs into clean JSON responses with the right status codes.

**Special events.** Event requests are validated: the date must be in the future (Calgary time), the start time must fall within opening hours, the guest count is limited, and every selected menu item must exist.

**Admin analytics.** `GET /stats` (admin only) uses MongoDB aggregation to return revenue, order counts, average order value, orders per day for the last 7 days, and the top 5 dishes. Cancelled orders are excluded.

**Simulated AI assistant.** `POST /chatbot` matches the customer's message against a keyword dataset in `data/chatbotResponses.js` and returns the best answer (specials, vegetarian options, recommendations, opening hours and so on). If the request includes a valid login token, it can answer "what did I order last time" from the customer's real order history. Guests are asked to log in, and customers with no orders yet are told so.

## Project structure

```
srms-backend/
  config/db.js              MongoDB connection
  models/                   User, MenuItem, Order, Reservation, Event schemas
  middleware/               auth.js (JWT + roles), validate.js, errorHandler.js
  routes/                   one file per resource, mounted in server.js
  data/chatbotResponses.js  keyword dataset and matcher for the assistant
  seed.js                   demo users and starter menu
  server.js                 app entry point
  .env.example              template for the environment variables
```

## Security notes

- Passwords are hashed with bcrypt and never returned by the API.
- `helmet` sets standard security headers and hides the `X-Powered-By` header.
- Login and register are rate limited: 15 failed attempts per 15 minutes per IP address (successful logins are not counted).
- Role checks run on the server for every admin route, and customers can only access their own data.
- An admin cannot delete their own account.
- Secrets live in `.env`, which is listed in `.gitignore`; `.env.example` contains only placeholders.

## Deployment

The API is deployed as a Render web service connected to this repo (build command `npm install`, start command `npm start`). The environment variables from `.env.example` are set in Render's dashboard, and the database is hosted on MongoDB Atlas. Render provides the `PORT` value automatically.

## References

This assignment was completed with the use of class resources, online resources, YouTube videos, and AI assistance.

Anthropic. (2026, September 22). *Assignment 1* [Generative AI chat]. Claude Sonnet 5. https://claude.ai/share/882e157b-528c-4b3e-9d49-9fa5c5e2e4a4
