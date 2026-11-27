import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const firebaseConfig={apiKey:'AIzaSyBwh0Q33XOipGmxwK1mAHLeOt97Z5ehYT8',authDomain:'registro-pea.firebaseapp.com',projectId:'registro-pea',messagingSenderId:'203315680971',appId:'1:203315680971:web:afd8cf1ff367b5bb0d2d4e',measurementId:'G-BE4V80Z3ZF'};
export const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);
export const fcmVapidKey=''; // Copia aquí la clave pública de Firebase Console → Cloud Messaging → Web Push certificates.
