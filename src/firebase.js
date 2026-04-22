import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBqhya5sP9OPF4IYhfhxu5gJp5rVxDwAYI",
  authDomain: "aller-test-dff61.firebaseapp.com",
  databaseURL: "https://aller-test-dff61-default-rtdb.firebaseio.com",
  projectId: "aller-test-dff61",
  storageBucket: "aller-test-dff61.firebasestorage.app",
  messagingSenderId: "656233405638",
  appId: "1:656233405638:web:f2de6f9f6ec6c01e288bc7"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);