// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBEU5Y5PfuDEh4H0kXnQiWnImu6W6aT0J4",
  authDomain: "sheep-game-a104e.firebaseapp.com",
  projectId: "sheep-game-a104e",
  storageBucket: "sheep-game-a104e.firebasestorage.app",
  messagingSenderId: "703255341391",
  appId: "1:703255341391:web:235c61a0b4a95b0aea7d3a",
  measurementId: "G-KGFTZ27W87"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);