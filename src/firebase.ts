import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig={
  apiKey:'AIzaSyBddExv3Wzmg4Cr0WPUIQ6pbpKHYLBTJR4',
  authDomain:'rivora-8643e.firebaseapp.com',
  projectId:'rivora-8643e',
  storageBucket:'rivora-8643e.firebasestorage.app',
  messagingSenderId:'139975275526',
  appId:'1:139975275526:web:f2e5c694de7e4da27fbf87',
}

const firebaseApp=initializeApp(firebaseConfig)

export const auth=getAuth(firebaseApp)
export const db=getFirestore(firebaseApp)
export const firebaseProjectId=firebaseConfig.projectId
