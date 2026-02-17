import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDDQ8mE8kDssOBeai82HGWtvmC_b1t92kI",
  authDomain: "family-fitness-3494e.firebaseapp.com",
  projectId: "family-fitness-3494e",
  storageBucket: "family-fitness-3494e.firebasestorage.app",
  messagingSenderId: "546604582637",
  appId: "1:546604582637:web:18e8899628b0c103f8aee4",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
