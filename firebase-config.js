<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyA4xfUevmevaMDxK2_gLgvZUoqm0gmCn_k",
    authDomain: "store-7b9bd.firebaseapp.com",
    projectId: "store-7b9bd",
    storageBucket: "store-7b9bd.firebasestorage.app",
    messagingSenderId: "1015427798898",
    appId: "1:1015427798898:web:a15c71636506fac128afeb",
    measurementId: "G-NR4JS3FLWG"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth();

  window.firebase = { auth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut };
</script>
