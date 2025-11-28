# Authentication Flow Documentation

## Overview

The application implements a multi-step authentication flow that integrates with both the User Management Service and the ZKP Query Service.

## Authentication Steps

### 1. User Login

**Endpoint:** `POST http://localhost:3000/user-management-service/api/users/login`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "status": "success",
  "tokens": {
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

The access and refresh tokens are stored in localStorage:

- `fincube_access_token`
- `fincube_refresh_token`

### 2. Fetch User Profile

**Endpoint:** `GET http://localhost:3000/user-management-service/api/users/profile`

**Headers:**

```
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "id": 5,
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "contact_number": "+1234567890",
  "wallet_address": "0x...",
  "is_active": true,
  "is_staff": false,
  "is_superuser": false,
  "is_verified_email": true,
  "is_verified_contact_number": true,
  "status": "active",
  "date_joined": "2025-11-25T12:14:14.205Z",
  "updated_at": "2025-11-25T12:14:14.205Z",
  "organizations": ["org1"]
}
```

The user profile is stored in localStorage as `fincube_user_profile`.

### 3. Fetch ZKP User Data

**Endpoint:** `GET http://localhost:7000/api/query/user/{user_id}`

Using the `id` from the user profile, fetch the ZKP-specific user data.

**Response:**

```json
{
  "success": true,
  "user": {
    "_id": "6925927183999d903e7f45d9",
    "user_id": 6,
    "batch_id": {
      "_id": "6925909883999d903e7f45c3",
      "createdAt": "2025-11-25T11:18:48.171Z",
      "updatedAt": "2025-11-25T11:26:41.644Z",
      "__v": 0
    },
    "balance": 10,
    "reference_number": "0x9f5c51c2d6c8138459f772641bbbd7745325809f_...",
    "zkp_key": "user@example.com",
    "createdAt": "2025-11-25T11:26:41.650Z",
    "updatedAt": "2025-11-25T11:26:41.650Z",
    "__v": 0,
    "organization": {
      "_id": "6925922f83999d903e7f45cc",
      "org_id": 6,
      "wallet_address": "0x9f5c51c2d6c8138459f772641bbbd7745325809f",
      "createdAt": "2025-11-25T11:25:35.919Z",
      "updatedAt": "2025-11-25T11:25:35.919Z",
      "__v": 0
    }
  }
}
```

The ZKP user data is stored in localStorage as `fincube_zkp_user`.

## State Management

### Auth Store (`authStore.ts`)

The auth store manages:

- `isSignedIn`: Boolean indicating if user is authenticated
- `userProfile`: User profile data from User Management Service
- `zkpUser`: ZKP user data from Query Service
- `loading`: Loading state for async operations
- `loadingText`: Text to display during loading

### Actions

- `signIn(userProfile, zkpUser)`: Sets user as signed in with their data
- `signOut()`: Clears all user data and signs out
- `setLoading(loading, text)`: Updates loading state
- `initialize()`: Restores auth state from localStorage on app load

## Components

### AuthModal

Handles user login and registration forms. On successful login:

1. Calls `authService.login()` which performs all 3 steps
2. Receives tokens, user profile, and ZKP user data
3. Calls `signIn()` with the user data
4. Closes modal and shows dashboard

### UserInfo

Displays the logged-in user's information:

- Name and email
- Contact number and user ID
- Account balance
- Organization wallet address

### Dashboard

Main application interface shown after login. Displays:

- User information (via UserInfo component)
- Transfer form
- Transaction history with fraud detection

## Token Refresh

The `authService` includes a `refreshAccessToken()` method that can be called when the access token expires:

```typescript
const newAccessToken = await authService.refreshAccessToken();
```

This uses the refresh token to obtain a new access token without requiring the user to log in again.

## Environment Variables

Configure the service URLs in `.env`:

```env
VITE_USER_MANAGEMENT_URL=http://localhost:3000
VITE_ZKP_API_URL=http://localhost:7000
```

## Security Notes

- Tokens are stored in localStorage (consider using httpOnly cookies for production)
- Access tokens should be included in Authorization header for authenticated requests
- Refresh tokens should be used to obtain new access tokens when they expire
- All sensitive operations should validate the access token on the backend
