import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyQVyhkpG4iuu77GTN3NvFrOH5deCAfrlM",
  authDomain: "sheep-game-e1aa0.firebaseapp.com",
  databaseURL: "https://sheep-game-e1aa0-default-rtdb.firebaseio.com",
  projectId: "sheep-game-e1aa0",
  storageBucket: "sheep-game-e1aa0.firebasestorage.app",
  messagingSenderId: "1003450643999",
  appId: "1:1003450643999:web:dea1e25dcb243dac33c72a",
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);