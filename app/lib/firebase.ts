// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCQUyhkpG4iuu77GTN3NvFrOH5deCAfrlM",
  authDomain: "sheep-game-e1aa0.firebaseapp.com",
  projectId: "sheep-game-e1aa0",
  storageBucket: "sheep-game-e1aa0.firebasestorage.app",
  messagingSenderId: "1003450643999",
  appId: "1:1003450643999:web:dea1e25dcb243dac33c72a",
  measurementId: "G-FKNQED719B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);