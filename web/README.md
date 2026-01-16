 f# Social Media API Documentation

This API supports both **Web** (NextAuth session-based) and **Mobile** (JWT-token based) authentication using a unified security layer.

---

## 🔐 Authentication

### Unified Auth Strategy
All protected endpoints accept either:
1. **NextAuth Session**: Via browser cookies.
2. **JWT Token**: Via `Authorization: Bearer <token>` header.

### 1. Mobile & Web Auth Endpoints

#### **POST** `/api/auth/register`
Create a new user account.
- **Body**: `{ email, password, username, name }`
- **Response**: `{ message, user, token }` (Token can be used immediately for mobile)

#### **POST** `/api/auth/mobile/login`
Authentication for mobile clients.
- **Body**: `{ email, password }`
- **Response**: `{ token, user }`

#### **POST** `/api/auth/mobile/refresh`
Refresh a JWT token.
- **Body**: `{ token }`
- **Response**: `{ token }` (New token)

#### **POST** `/api/auth/mobile/logout`
Logout (primarily client-side, endpoint provided for future use).
- **Response**: `{ message: "Logged out successfully" }`

---

## 👤 User Management
*Requires Authentication*

#### **GET** `/api/user/me`
Get current authenticated user's profile.
- **Header**: `Authorization: Bearer <token>` (Mobile) or Session Cookie (Web)
- **Response**: `{ user: { id, email, username, name, avatarUrl, bio, createdAt } }`

#### **PATCH** `/api/user/profile`
Update profile information.
- **Body**: `{ name?, bio?, avatarUrl?, username? }`
- **Response**: `{ user: updatedUser }`

#### **PATCH** `/api/user/password`
Change current user's password.
- **Body**: `{ currentPassword, newPassword }`
- **Response**: `{ message: "Password updated successfully" }`

#### **DELETE** `/api/user/account`
Permanently delete user account and associated data.
- **Response**: `{ message: "Account deleted successfully" }`

---

## 📮 Posts
*Requires Authentication*

#### **GET** `/api/(protected)/post`
Retrieve all posts.
- **Response**: `Array<Post>`

#### **POST** `/api/(protected)/post`
Create a new post with an image.
- **Content-Type**: `multipart/form-data`
- **Body**: 
  - `caption` (text): The text content of the post.
  - `authorId` (text): The ID of the author.
  - `image` (file): The image file to upload.

> **Note**: Image URLs returned by this endpoint (e.g., `/api/storage/file.png`) are **protected**. You must provide an `Authorization: Bearer <token>` header when fetching them.
  ```
- **Response**: `Post object`

#### **PUT** `/api/(protected)/post/[id]`
Update a post.
- **Body**: `{ caption?, media? }`
- **Response**: `Post object`

#### **DELETE** `/api/(protected)/post/[id]`
Delete a post.
- **Response**: `{ message: "Post deleted successfully" }`

---

## 🛠 Usage Examples

### Mobile (Bearer Token)
```bash
# Login to get token
curl -X POST http://localhost:3000/api/auth/mobile/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "..."}'

# Use token for protected request
curl http://localhost:3000/api/user/me \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Web (NextAuth Cookies)
```bash
# Sign in using NextAuth default signin or custom
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "...", "password": "..."}'

# Use cookie
curl http://localhost:3000/api/user/me -b cookies.txt
```
