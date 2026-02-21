/**
 * Setup Admin User Script
 * 
 * Run this script once to create the initial admin user in Firebase.
 * 
 * Usage:
 * 1. Make sure Firebase is configured in src/lib/firebase.ts
 * 2. Run: npm run setup-admin
 * 3. Enter admin email and password when prompted
 * 
 * Or manually create admin user:
 * 1. Go to Firebase Console > Authentication > Add User
 * 2. Create user with email: abhisheksinghania@gmail.com, password: abhi613
 * 3. Copy the UID
 * 4. Go to Realtime Database and add:
 *    users/{UID}:
 *      email: "abhisheksinghania@gmail.com"
 *      name: "System Admin"
 *      role: "admin"
 *      phone: ""
 *      linkedDevices: {}
 */

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, database } from '../lib/firebase';

const ADMIN_EMAIL = 'abhisheksinghania@gmail.com';
const ADMIN_PASSWORD = 'abhi613';
const ADMIN_NAME = 'System Admin';

export const setupAdmin = async () => {
  try {
    console.log('Creating admin user...');
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    const uid = userCredential.user.uid;
    
    console.log('Admin user created with UID:', uid);
    
    // Create user record in database
    await set(ref(database, `users/${uid}`), {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: 'admin',
      phone: '',
      linkedDevices: {},
    });
    
    console.log('Admin user record created in database');
    console.log('✅ Setup complete! You can now login with:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    
    // Sign out after setup
    await auth.signOut();
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️  Admin user already exists. Skipping creation.');
      console.log('If you need to reset, delete the user from Firebase Console.');
    } else {
      console.error('❌ Error setting up admin:', error);
      throw error;
    }
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupAdmin().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
