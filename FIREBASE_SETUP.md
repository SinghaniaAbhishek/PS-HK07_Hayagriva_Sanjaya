# Firebase Setup Guide for Sanjaya

## Prerequisites
- Firebase project created at https://console.firebase.google.com
- Firebase Realtime Database enabled
- Firebase Authentication enabled (Email/Password provider)

## Step 1: Deploy Security Rules

1. Go to Firebase Console > Realtime Database > Rules
2. Copy the contents of `firebase-rules.json`
3. Paste into the Rules editor
4. Click "Publish"

## Step 2: Create Admin User

### Option A: Using Firebase Console (Recommended)

1. Go to Firebase Console > Authentication > Users
2. Click "Add user"
3. Enter:
   - Email: `abhisheksinghania@gmail.com`
   - Password: `abhi613`
4. Click "Add user"
5. Copy the User UID (click on the user to see it)

6. Go to Firebase Console > Realtime Database > Data
7. Click "+" to add a new node
8. Create path: `users/{UID}` (replace {UID} with the actual UID)
9. Add these fields:
   ```json
   {
     "email": "abhisheksinghania@gmail.com",
     "name": "System Admin",
     "role": "admin",
     "phone": "",
     "linkedDevices": {}
   }
   ```

### Option B: Using Firebase CLI

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init

# Deploy rules
firebase deploy --only database
```

## Step 3: Verify Configuration

1. Check `src/lib/firebase.ts` has your Firebase config
2. Start the app: `npm run dev`
3. Try logging in with:
   - Email: `abhisheksinghania@gmail.com`
   - Password: `abhi613`

## Database Structure

```
users/
  {userId}/
    email: string
    name: string
    role: "admin" | "guardian"
    phone: string
    linkedDevices/
      {key}: deviceId

devices/
  {deviceId}/
    assignedTo: userId
    userName: string
    userPhone: string
    mentorPhone: string
    gps/
      lat: number
      lng: number
    battery: number
    fallStatus: boolean
    vibrationStatus: boolean
    movementStatus: boolean
    lastUpdated: timestamp
    imageURL: string (optional)
```

## Security Rules Summary

- **Admin**: Can read/write all users and devices
- **Guardian**: Can read their own user data and assigned devices
- **Guardian**: Can update userName, userPhone, mentorPhone for their assigned devices
- **Device Assignment**: Only admin can link/unlink devices

## Troubleshooting

### "Permission denied" errors
- Check that security rules are deployed
- Verify user role is set correctly in database
- Check that user is authenticated

### "User not found" errors
- Verify user exists in Authentication
- Verify user record exists in Realtime Database under `users/{uid}`
- Check that role field is set

### Real-time updates not working
- Check browser console for errors
- Verify Firebase Realtime Database is enabled
- Check network tab for WebSocket connections

## Next Steps

1. Create guardian accounts via Admin Panel
2. Register devices via Admin Panel
3. Link devices to guardians via Admin Panel
4. Guardians can login and set up device profiles
