import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyCFv5UTfIPC_c-Q9qv_U8OToIc5pGO1MWY",
  authDomain: "connectnow-1829.firebaseapp.com",
  projectId: "connectnow-1829",
  storageBucket: "connectnow-1829.firebasestorage.app",
  messagingSenderId: "657346319722",
  appId: "1:657346319722:web:469f091c56ec577c960113"
};


const app =
  initializeApp(firebaseConfig);


export const auth =
  initializeAuth(app, {
    persistence:
      browserLocalPersistence,

    popupRedirectResolver:
      browserPopupRedirectResolver
  });


export const db =
  getFirestore(app);


export default app;