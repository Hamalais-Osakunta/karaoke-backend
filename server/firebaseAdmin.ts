import * as admin from 'firebase-admin';
import { FIREBASE_CONFIG } from './config';

const serviceAccount = require(FIREBASE_CONFIG.serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: FIREBASE_CONFIG.databaseURL,
});

export const db = admin.firestore();
export { admin };
