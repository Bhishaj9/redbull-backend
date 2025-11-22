# Red Bull Backend

This is the backend API for the Red Bull application, built with Node.js, Express, and MongoDB.

## Features

- **Authentication**: User registration and login with JWT.
- **Plans**: Manage investment plans (buy/timer types).
- **Purchases**: Track user plan purchases.
- **Withdrawals**: Handle user withdrawal requests.
- **Admin Panel**: Manage users, plans, and withdrawals.
- **Payment Integration**: Razorpay integration for deposits.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Authentication**: JSON Web Tokens (JWT)

## Getting Started

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file with your credentials (see `.env.example` if available, or check `server.js` for required variables).
4.  Run the server:
    ```bash
    npm start
    ```

## API Endpoints

- `/api/auth`: Authentication routes
- `/api/plans`: Plan management
- `/api/purchases`: Purchase operations
- `/api/withdraws`: Withdrawal requests
- `/api/admin`: Admin dashboard routes
