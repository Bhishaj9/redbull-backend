# Red Bull Backend

This is the backend API and frontend application for the Red Bull investment platform. It is built with Node.js, Express, and MongoDB.

## Features
- **User Authentication**: Register, Login, Logout (JWT-based).
- **Wallet System**: Recharge wallet (Razorpay integration) and withdraw funds.
- **Investment Plans**: Purchase plans and earn daily income.
- **Referral System**: Invite users and earn commissions.
- **Admin Panel**: Manage users, approve withdrawals, and create plans.

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Frontend**: HTML, CSS, Vanilla JavaScript

## Setup Instructions

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root directory with the following:
    ```env
    PORT=4000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    RAZORPAY_KEY_ID=your_razorpay_key_id
    RAZORPAY_KEY_SECRET=your_razorpay_key_secret
    ADMIN_PASS=admin@123
    FRONTEND_URL=http://localhost:4000
    ```

3.  **Start the Server**:
    ```bash
    npm start
    ```
    The server will run on `http://localhost:4000`.

## API Endpoints

### Auth
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile

### Purchases
- `POST /api/purchases/create-order` - Create Razorpay order
- `POST /api/purchases/verify` - Verify payment

### Withdrawals
- `POST /api/withdraws/request` - Request a withdrawal
- `GET /api/withdraws/my` - Get withdrawal history

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/withdraws/:id/process` - Approve/Reject withdrawal

## Deployment
This project is ready for deployment on platforms like **Render**, **Railway**, or **Heroku**. Ensure you set the environment variables in your hosting provider's dashboard.
