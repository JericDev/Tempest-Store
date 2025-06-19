// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// Your web app's Firebase configuration
// IMPORTANT: Using Canvas global variables if available, otherwise fallback to hardcoded config.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyA4xfUevmevaMDxK2_gLgvZUoqm0gmCn_k",
    authDomain: "store-7b9bd.firebaseapp.com",
    projectId: "store-7b9bd",
    storageBucket: "store-7b9bd.firebase-storage.app",
    messagingSenderId: "1015427798898",
    appId: "1:1015427798898:web:a15c71636506fac128afeb",
    measurementId: "G-NR4JS3FLWG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

let currentUserId = null; // To store the current authenticated user's ID
let isAdmin = false; // Flag to check if the current user is an admin
// IMPORTANT: Replace "YOUR_ADMIN_UID_HERE" with the actual UID of your admin user from Firebase Authentication.
// You can find your UID in the Firebase Console -> Authentication -> Users tab.
const ADMIN_UID = "LigBezoWV9eVo8lglsijoWinKmA2"; // Updated with the provided UID

let cart = []; // Global cart array
let userOrders = []; // Global array to store user's orders (for user history)
let allProducts = []; // Global array to store all products from Firestore
let sellerIsOnline = false; // New: Global variable for seller status

// New global variable for filtering
let currentCategory = 'all'; // Initialize with 'all' category

// Global variables to store unsubscribe functions for real-time listeners
let unsubscribeUserOrders = null;
let unsubscribeProducts = null;
let unsubscribeSiteSettings = null; // New: Unsubscribe for site settings listener

// Reference to the admin panel initialization function from admin.js
let initAdminPanelModule = null;
let adminCleanupFunction = null;

// --- Custom Message Box DOM Elements ---
const messageBox = document.createElement('div');
messageBox.id = 'custom-message-box';
messageBox.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50 hidden';
messageBox.innerHTML = `
    <div class="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-auto transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="flex justify-between items-center pb-3">
            <h3 class="text-xl font-semibold text-gray-900" id="message-box-title">Message</h3>
            <button type="button" class="text-gray-400 hover:text-gray-600 text-2xl" id="close-message-box">&times;</button>
        </div>
        <div class="mt-2 text-sm text-gray-500" id="message-box-content"></div>
        <div class="mt-4 flex justify-end">
            <button type="button" class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" id="message-box-ok-button">OK</button>
        </div>
    </div>
`;
document.body.appendChild(messageBox);

const messageBoxTitle = document.getElementById('message-box-title');
const messageBoxContent = document.getElementById('message-box-content');
const closeMessageBoxBtn = document.getElementById('close-message-box');
const messageBoxOkBtn = document.getElementById('message-box-ok-button');

function showMessageBox(title, message) {
    messageBoxTitle.textContent = title;
    messageBoxContent.textContent = message;
    messageBox.classList.remove('hidden');
}

function hideMessageBox() {
    messageBox.classList.add('hidden');
}

closeMessageBoxBtn.addEventListener('click', hideMessageBox);
messageBoxOkBtn.addEventListener('click', hideMessageBox);
messageBox.addEventListener('click', (event) => {
    if (event.target === messageBox) {
        hideMessageBox();
    }
});


// --- DOM elements for Authentication ---
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const registerButton = document.getElementById("register-button");
const loginButton = document.getElementById("login-button");
const loginRegisterButton = document.getElementById("login-register-button");
const logoutButton = document.getElementById("logout-button");
const myOrdersButton = document.getElementById("my-orders-button");
// adminPanelButton is now managed by admin.js, but its visibility by script.js
const adminPanelButton = document.getElementById("admin-panel-button");
const authMessage = document.getElementById("auth-message");
const userDisplay = document.getElementById("user-display");
const authModal = document.getElementById("auth-modal");
const closeAuthModalBtn = document.getElementById("close-auth-modal");
const forgotPasswordButton = document.getElementById("forgot-password-button"); // New: Forgot Password button


// --- DOM elements for Cart/Checkout ---
const cartIconBtn = document.getElementById("cart-icon-btn");
const cartCountBadge = document.getElementById("cart-count");
const cartModal = document.getElementById("cart-modal");
const closeCartModalBtn = document.getElementById("close-cart-modal");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartSubtotalSpan = document.getElementById("cart-subtotal");
const cartTotalSpan = document.getElementById("cart-total");
const placeOrderBtn = document.getElementById("place-order-btn");
const robloxUsernameInput = document.getElementById("roblox-username-input");

// --- DOM elements for Order History ---
const orderHistoryModal = document.getElementById("order-history-modal");
const closeOrderHistoryModalBtn = document.getElementById("close-order-history-modal");
const orderHistoryList = document.getElementById("order-history-list");
const orderHistoryTitle = document.getElementById("order-history-title");
const orderDetailsView = document.getElementById("order-details-view");
const detailOrderId = document.getElementById("detail-order-id");
const detailOrderDate = document.getElementById("detail-order-date");
const detailOrderStatus = document.getElementById("detail-order-status");
const detailOrderPrice = document.getElementById("detail-order-price");
const detailPaymentMethod = document.getElementById("detail-payment-method");
const detailRobloxUsername = document.getElementById("detail-roblox-username");
const detailItemsList = document.getElementById("detail-items-list");
const backToOrderListBtn = document.getElementById("back-to-order-list");

// --- New DOM elements for Seller Status ---
const sellerStatusDisplay = document.getElementById("seller-status-display");


// --- Authentication Functions ---
registerButton.addEventListener("click", () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) { showMessageBox("Error", "Please enter email and password."); return; }
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            authMessage.textContent = `Registered and logged in as: ${userCredential.user.email}`;
            authMessage.style.color = 'green';
            console.log("User registered:", userCredential.user.email);
            authModal.classList.remove('show');
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                authMessage.textContent = "Registration failed: This email is already in use. Try logging in.";
            } else {
                authMessage.textContent = `Registration failed: ${error.message}`;
            }
            authMessage.style.color = 'red';
            console.error("Registration error:", error);
        });
});

loginButton.addEventListener("click", () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) { showMessageBox("Error", "Please enter email and password."); return; }
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            authMessage.textContent = `Logged in as: ${userCredential.user.email}`;
            authMessage.style.color = 'green';
            console.log("User logged in:", userCredential.user.email);
            authModal.classList.remove('show');
        })
        .catch((error) => {
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    authMessage.textContent = "Login failed: Invalid email or password.";
                    break;
                case 'auth/invalid-email':
                    authMessage.textContent = "Login failed: The email address is not valid.";
                    break;
                case 'auth/user-disabled':
                    authMessage.textContent = "Login failed: This account has been disabled.";
                    break;
                default:
                    authMessage.textContent = `Login failed: ${error.message}`;
            }
            authMessage.style.color = 'red';
            console.error("Login error:", error);
        });
});

logoutButton.addEventListener("click", () => {
    signOut(auth)
        .then(() => {
            authMessage.textContent = "Logged out successfully.";
            authMessage.style.color = 'green';
            console.log("User logged out.");
        })
        .catch((error) => {
            authMessage.textContent = `Logout failed: ${error.message}`;
            authMessage.style.color = 'red';
            console.error("Logout error:", error);
        });
});

loginRegisterButton.addEventListener('click', () => {
    authModal.classList.add('show');
    authMessage.textContent = "";
    authMessage.style.color = 'red';
    authEmailInput.value = "";
    authPasswordInput.value = "";
});

closeAuthModalBtn.addEventListener('click', () => {
    authModal.classList.remove('show');
});

authModal.addEventListener('click', (event) => {
    if (event.target === authModal) {
        authModal.classList.remove('show');
    }
});

// --- Forgot Password Functionality ---
forgotPasswordButton.addEventListener('click', () => {
    const email = authEmailInput.value.trim();
    if (!email) {
        showMessageBox("Error", "Please enter your email to reset your password.");
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => {
            showMessageBox("Success", `Password reset email sent to ${email}. Check your inbox!`);
            authEmailInput.value = "";
            authPasswordInput.value = "";
        })
        .catch((error) => {
            switch (error.code) {
                case 'auth/invalid-email':
                    showMessageBox("Error", "Password reset failed: The email address is not valid.");
                    break;
                case 'auth/user-not-found':
                    showMessageBox("Error", "Password reset failed: No user found with that email address.");
                    break;
                default:
                    showMessageBox("Error", `Password reset failed: ${error.message}`);
            }
            console.error("Password reset error:", error);
        });
});

// --- Authentication State Observer (Crucial for loading user data) ---
onAuthStateChanged(auth, async (user) => {
    // Unsubscribe from any existing listeners that are managed here
    if (unsubscribeUserOrders) {
        unsubscribeUserOrders();
        unsubscribeUserOrders = null;
    }
    // Product listener is always active, no need to unsubscribe here.

    // Clean up admin panel if currently active
    if (adminCleanupFunction) {
        adminCleanupFunction();
        adminCleanupFunction = null;
    }

    if (user) {
        currentUserId = user.uid; // Set current user ID
        isAdmin = (currentUserId === ADMIN_UID); // Check if current user is admin

        // MODIFIED: Handle null/undefined user.email for anonymous users
        userDisplay.textContent = user.email ? `Welcome, ${user.email}` : `Welcome, Guest (${user.uid.substring(0, 8)}...)`;
        
        loginRegisterButton.style.display = "none";
        logoutButton.style.display = "inline-block";
        myOrdersButton.style.display = "inline-block";

        if (isAdmin) {
            adminPanelButton.style.display = "inline-block"; // Show Admin Panel button
            // Dynamically import and initialize admin module
            if (!initAdminPanelModule) {
                try {
                    // Ensure the path is correct relative to script.js
                    const adminModule = await import('./admin.js');
                    initAdminPanelModule = adminModule.initAdminPanel;
                    adminCleanupFunction = adminModule.cleanupAdminPanel; // Get cleanup function
                } catch (error) {
                    console.error("Error loading admin.js:", error);
                    // Hide admin button if load fails
                    adminPanelButton.style.display = "none";
                }
            }
            if (initAdminPanelModule) {
                // Pass Firestore and Auth instances, plus user info, toggle function, and a GETTER for current seller status
                initAdminPanelModule(db, auth, currentUserId, isAdmin, toggleSellerStatus, () => sellerIsOnline);
            }
        } else {
            adminPanelButton.style.display = "none";
        }

        robloxUsernameInput.style.display = "block";

        await loadCartFromFirestore(currentUserId);
        await syncCartOnLogin(currentUserId);

        unsubscribeUserOrders = setupUserOrderHistoryListener(currentUserId);

    } else {
        currentUserId = null;
        isAdmin = false;

        userDisplay.textContent = "";
        loginRegisterButton.style.display = "inline-block";
        logoutButton.style.display = "none";
        myOrdersButton.style.display = "none";
        adminPanelButton.style.display = "none";

        robloxUsernameInput.style.display = "none";

        cart = loadCartFromLocalStorage();
        userOrders = [];
    }
    authEmailInput.value = "";
    authPasswordInput.value = "";
    authMessage.textContent = "";
    authMessage.style.color = 'red';
    renderCart(); // This call is crucial to render the cart state (either from Firestore or LocalStorage)
    // Products are always rendered via the setupProductsListener called globally.
});

// --- Canvas Initial Authentication ---
// This block ensures Firebase authentication is handled correctly for Canvas environment.
// It uses __initial_auth_token for custom token sign-in or signs in anonymously.
// This needs to run once when the script loads.
(async () => {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("Signed in with custom token from Canvas environment.");
        } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously because no custom token was provided.");
        }
    } catch (error) {
        console.error("Firebase initial authentication failed:", error);
        showMessageBox("Authentication Error", "Could not initialize Firebase authentication. Please try again. Details: " + error.message);
    }
})();


// --- Firestore Collection Paths ---
// Using __app_id global variable if available, otherwise fallback.
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'tempest-store-app';
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const USER_CARTS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/carts`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;
const SITE_SETTINGS_COLLECTION_PATH = `artifacts/${APP_ID}/settings`; // New: Path for site settings

// --- Product Display (Accessible to all) ---
function setupProductsListener() {
    const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
    return onSnapshot(productsColRef, (snapshot) => {
        const fetchedProducts = [];
        snapshot.forEach(doc => {
            // Ensure price fields are numbers when fetched
            const data = doc.data();
            fetchedProducts.push({ 
                id: doc.id, 
                ...data,
                price: typeof data.price === 'string' ? parseFloat(data.price.replace('₱', '')) : data.price,
                salePrice: typeof data.salePrice === 'string' ? parseFloat(data.salePrice.replace('₱', '')) : data.salePrice
            });
        });
        allProducts = fetchedProducts.filter(p => p.price !== undefined && !isNaN(p.price)); // Filter out products with invalid prices
        console.log("Fetched Products from Firestore:", allProducts); // Added for debugging
        applyFilters(); // Call applyFilters after products are fetched and updated
    }, (error) => {
        console.error("Error listening to products:", error);
    });
}

// Call setupProductsListener once when the script loads to always show products
unsubscribeProducts = setupProductsListener();

// --- New: Site Settings Listener and Functions ---
function setupSiteSettingsListener() {
    // Listen to a specific document (e.g., 'global') in the settings collection
    const settingsDocRef = doc(db, SITE_SETTINGS_COLLECTION_PATH, 'global');
    return onSnapshot(settingsDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            sellerIsOnline = data.sellerOnline || false; // Default to offline if not set
            updateSellerStatusDisplay();
            // When admin panel is opened or tab is switched, admin.js will fetch the current state
            // using the getter function provided during initAdminPanel.
        } else {
            console.log("No 'global' settings document found. Initializing with default status.");
            // If document doesn't exist, create it with default status. This write needs admin rights.
            // A more robust solution would be to create this document via a server-side script or admin panel setup.
            // Attempt to set if current user is admin, or if it's the initial (anonymous) sign-in.
            // The `onAuthStateChanged` handler might run after this, setting `isAdmin` properly.
            // So, for initial setup, it's generally fine if _any_ authenticated user creates it.
            if (auth.currentUser) { // Check if any user is authenticated (even anonymously)
                 try {
                    await setDoc(settingsDocRef, { sellerOnline: false });
                    console.log("Initialized 'global' settings document.");
                 } catch (e) {
                    console.error("Error initializing 'global' settings document:", e);
                    // If it fails, it's likely a permission issue (e.g. for non-admin anonymous users)
                    // The seller status will remain false based on the default value.
                 }
            }
            sellerIsOnline = false;
            updateSellerStatusDisplay();
        }
    }, (error) => {
        console.error("Error listening to site settings:", error);
    });
}

function updateSellerStatusDisplay() {
    if (sellerIsOnline) {
        sellerStatusDisplay.textContent = "Seller Status: Online";
        sellerStatusDisplay.classList.remove("status-offline");
        sellerStatusDisplay.classList.add("status-online");
    } else {
        sellerStatusDisplay.textContent = "Seller Status: Offline";
        sellerStatusDisplay.classList.remove("status-online");
        sellerStatusDisplay.classList.add("status-offline");
    }
}

async function toggleSellerStatus(isOnline) {
    try {
        const settingsDocRef = doc(db, SITE_SETTINGS_COLLECTION_PATH, 'global');
        await updateDoc(settingsDocRef, { sellerOnline: isOnline });
        console.log("Seller status updated to:", isOnline);
    } catch (e) {
        console.error("Error updating seller status:", e);
        showMessageBox("Error", "Error updating seller status: " + e.message);
    }
}

// Call setupSiteSettingsListener once when the script loads
unsubscribeSiteSettings = setupSiteSettingsListener();


// --- Cart Persistence (Customer-side) ---
async function saveCartToFirestore(userId, cartData) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        await setDoc(userCartRef, { items: JSON.stringify(cartData) });
        console.log("Cart saved to Firestore for user:", userId);
    } catch (e) {
        console.error("Error saving cart to Firestore:", e);
        showMessageBox("Cart Error", "Could not save cart to cloud: " + e.message);
    }
}

async function loadCartFromFirestore(userId) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        const docSnap = await getDoc(userCartRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // IMPORTANT: Ensure 'data.items' is a string before parsing, or handle non-string data gracefully
            if (typeof data.items === 'string') {
                cart = JSON.parse(data.items);
            } else {
                console.warn("Firestore cart 'items' field is not a JSON string. Resetting cart for user:", userId, "Data:", data.items);
                cart = []; // Reset cart if data is malformed
            }
            console.log("Cart loaded from Firestore for user:", userId, "Contents:", cart); // More detailed log
        } else {
            cart = [];
            console.log("No cart found in Firestore for user:", userId);
        }
        console.log("Cart state after loadCartFromFirestore:", cart); // Debugging line
    } catch (e) {
        console.error("Error loading cart from Firestore, or parsing data:", e);
        showMessageBox("Cart Error", "Could not load cart from cloud: " + e.message + " (Your cart might be reset if data was malformed or permissions are incorrect.)");
        cart = []; // Ensure cart is always an array on error
    }
}

function saveCartToLocalStorage(cartData) {
    // Check if localStorage is available and allowed
    try {
        localStorage.setItem('tempestStoreCart', JSON.stringify(cartData));
        console.log("Cart saved to Local Storage:", cartData); // Debugging log
    } catch (e) {
        console.warn("Local storage access denied or full. Cart will not be saved locally.", e);
        // Do not show a message box here, as it's a known Canvas limitation.
    }
}

function loadCartFromLocalStorage() {
    // Check if localStorage is available and allowed
    try {
        const storedCart = localStorage.getItem('tempestStoreCart');
        const loadedCart = storedCart ? JSON.parse(storedCart) : [];
        console.log("Cart loaded from Local Storage:", loadedCart); // Debugging log
        return loadedCart;
    } catch (e) {
        console.warn("Local storage access denied or unable to load. Returning empty cart.", e);
        return []; // Return empty cart if localStorage fails
    }
}

async function syncCartOnLogin(userId) {
    const localCart = loadCartFromLocalStorage();
    if (localCart.length > 0) {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        const docSnap = await getDoc(userCartRef);
        let firestoreCart = [];
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (typeof data.items === 'string') { // Ensure it's a string before parsing
                 firestoreCart = JSON.parse(data.items);
            } else {
                 console.warn("Firestore cart 'items' field (during sync) is not a JSON string. Starting with empty Firestore cart for sync.");
            }
        }

        localCart.forEach(localItem => {
            const existingItemIndex = firestoreCart.findIndex(item => item.id === localItem.id);
            if (existingItemIndex > -1) {
                firestoreCart[existingItemIndex].quantity += localItem.quantity;
            } else {
                // When syncing, ensure effectivePrice is correctly set based on current product data.
                const productDetails = allProducts.find(p => p.id === localItem.id);
                // Ensure productDetails.price and productDetails.salePrice are numbers
                let priceToUse = localItem.price; // Fallback to local item's price
                if (productDetails) {
                    const prodPrice = typeof productDetails.price === 'string' ? parseFloat(productDetails.price.replace('₱', '')) : productDetails.price;
                    const prodSalePrice = typeof productDetails.salePrice === 'string' ? parseFloat(productDetails.salePrice.replace('₱', '')) : productDetails.salePrice;

                    priceToUse = productDetails.sale && typeof prodSalePrice === 'number' ? prodSalePrice : prodPrice;
                }
                firestoreCart.push({ ...localItem, effectivePrice: priceToUse });
            }
        });
        cart = firestoreCart;
        await saveCartToFirestore(userId, cart);
        localStorage.removeItem('tempestStoreCart');
        console.log("Cart state after syncCartOnLogin (synced to Firestore and local cleared):", cart); // Debugging line
        renderCart();
    } else {
        console.log("No local cart to sync."); // Debugging line
    }
}

// --- Customer Order History (User-side) ---
function setupUserOrderHistoryListener(userId) {
    const ordersCollectionRef = collection(db, USER_ORDERS_COLLECTION_PATH(userId));
    // IMPORTANT: Firebase orderBy() requires an index for the field.
    // If you don't have an index for "orderDate", this query will fail.
    // As per Canvas guidelines, if orderBy() causes issues, you might need to fetch all and sort in JS.
    const q = query(ordersCollectionRef, orderBy("orderDate", "desc"));
    return onSnapshot(q, (snapshot) => {
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            const orderData = doc.data();
            // Ensure total is a number before toFixed
            orderData.total = typeof orderData.total === 'string' ? parseFloat(orderData.total.replace('₱', '')) : orderData.total;
            // Also ensure items are properly parsed if they were stringified (though orderDetails already deep copies)
            if (orderData.items && typeof orderData.items === 'string') {
                try {
                    orderData.items = JSON.parse(orderData.items);
                } catch (e) {
                    console.error("Error parsing order items for order:", doc.id, e);
                    orderData.items = []; // Default to empty array if parsing fails
                }
            }
            fetchedOrders.push({ id: doc.id, ...orderData });
        });
        userOrders = fetchedOrders;
        renderOrderHistory();
    }, (error) => {
        console.error("Error listening to user order history:", error);
        showMessageBox("Order History Error", "Could not load order history: " + error.message);
    });
}

// --- Cart Management Functions ---
function addToCart(product) {
    // Ensure cart is an array before using find/push
    if (!Array.isArray(cart)) {
        cart = [];
        console.warn("Cart was not an array when addToCart was called. Initializing as empty array.");
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        // Ensure effectivePrice is based on product's current sale status/price
        // product.price and product.salePrice should already be numbers from setupProductsListener
        const priceToUse = product.sale && typeof product.salePrice === 'number' ? product.salePrice : product.price;
        cart.push({ ...product, quantity: 1, effectivePrice: priceToUse });
    }
    saveCart();
    renderCart();
    console.log("Cart contents after adding:", cart);
}

function removeFromCart(productId) {
    // Ensure cart is an array before filtering
    if (!Array.isArray(cart)) {
        cart = [];
        console.warn("Cart was not an array when removeFromCart was called. Initializing as empty array.");
    }
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
    console.log("Cart contents after removing:", cart);
}

function updateCartQuantity(productId, newQuantity) {
    // Ensure cart is an array before finding item
    if (!Array.isArray(cart)) {
        cart = [];
        console.warn("Cart was not an array when updateCartQuantity was called. Initializing as empty array.");
    }
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = Math.max(1, newQuantity);
        saveCart();
        renderCart();
        console.log("Cart contents after quantity update:", cart);
    }
}

function saveCart() {
    if (currentUserId) {
        saveCartToFirestore(currentUserId, cart);
    } else {
        saveCartToLocalStorage(cart); // This will attempt to use localStorage, which may fail in Canvas
    }
    updateCartCountBadge();
}

function updateCartCountBadge() {
    // Ensure cart is an array before reducing
    const totalItems = Array.isArray(cart) ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
    cartCountBadge.textContent = totalItems;
    cartCountBadge.style.display = totalItems > 0 ? 'inline-block' : 'none';

    const { total } = calculateCartTotals();
    placeOrderBtn.textContent = `Place Order (${totalItems} item${totalItems !== 1 ? 's' : ''}) ₱${total.toFixed(2)}`;

    // Disable place order button if cart is empty or seller is offline (if logged in)
    placeOrderBtn.disabled = totalItems === 0 || (currentUserId && robloxUsernameInput.value.trim() === '') || !sellerIsOnline;

    // Optional: Add a tooltip or message if disabled due to seller being offline
    if (!sellerIsOnline && currentUserId) {
        placeOrderBtn.title = "Cannot place order: Seller is currently offline.";
    } else if (robloxUsernameInput.value.trim() === '' && currentUserId) {
        placeOrderBtn.title = "Please enter your Roblox Username.";
    } else if (totalItems === 0) {
        placeOrderBtn.title = "Your cart is empty.";
    } else {
        placeOrderBtn.title = ""; // Clear tooltip
    }
}

function renderCart() {
    console.log("renderCart() called. Current cart state:", cart); // Debugging line
    cartItemsContainer.innerHTML = '';

    // Explicitly check if cart is an array to prevent TypeError
    if (!Array.isArray(cart) || cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        return; // Exit if cart is not an array or is empty
    }

    cart.forEach(item => {
        // Find the latest product details from allProducts
        const productDetails = allProducts.find(p => p.id === item.id);
        let priceToDisplay;
        if (productDetails) {
            // Use the live price from allProducts if available and valid
            // productDetails.price and productDetails.salePrice should already be numbers from setupProductsListener
            priceToDisplay = productDetails.sale && typeof productDetails.salePrice === 'number' ? productDetails.salePrice : productDetails.price;
            // Update item's effectivePrice in cart to match latest
            item.effectivePrice = priceToDisplay;
        } else {
            // Fallback if product is no longer found (e.g., deleted by admin)
            // Use item.effectivePrice if it exists, otherwise fall back to item.price (original price from when added)
            priceToDisplay = item.effectivePrice || item.price;
            // Ensure it's a number for toFixed, parsing if it came in as a string with '₱'
            if (typeof priceToDisplay === 'string') {
                priceToDisplay = parseFloat(priceToDisplay.replace('₱', ''));
            }
        }
        // Format the price for display, ensuring it's a number first
        priceToDisplay = typeof priceToDisplay === 'number' ? `₱${priceToDisplay.toFixed(2)}` : priceToDisplay;


        const imageUrl = `images/${item.image}`;
        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'cart-item';
        cartItemDiv.innerHTML = `
            <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/f0f0f0/888?text=Image%20N/A';" />
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <div class="cart-item-price">${priceToDisplay}</div>
            </div>
            <div class="cart-item-quantity-control">
                <button data-id="${item.id}" data-action="decrease">-</button>
                <input type="number" value="${item.quantity}" min="1" data-id="${item.id}">
                <button data-id="${item.id}" data-action="increase">+</button>
            </div>
            <button class="cart-item-remove" data-id="${item.id}">&times;</button>
        `;
        cartItemsContainer.appendChild(cartItemDiv);
    });

    cartItemsContainer.querySelectorAll('.cart-item-quantity-control button').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.id;
            const input = event.target.parentElement.querySelector('input');
            let newQuantity = parseInt(input.value);
            const action = event.target.dataset.action;

            if (action === 'increase') {
                newQuantity++;
            } else if (action === 'decrease') {
                newQuantity--;
            }
            updateCartQuantity(productId, newQuantity);
        });
    });

    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.id;
            removeFromCart(productId);
        });
    });

    calculateCartTotals();
    updateCartCountBadge();
}

function calculateCartTotals() {
    let subtotal = 0;
    let totalItemsInCart = 0;
    // Ensure cart is an array before iterating
    if (Array.isArray(cart)) {
        cart.forEach(item => {
            // IMPORTANT: Use the effectivePrice from the cart item, which is updated in renderCart()
            // or fall back to item.price if effectivePrice isn't set (shouldn't happen with updated logic)
            let priceValue = item.effectivePrice || item.price;
            if (typeof priceValue === 'string') {
                priceValue = parseFloat(priceValue.replace('₱', ''));
            }
            // Ensure priceValue is a valid number before multiplication
            if (!isNaN(priceValue)) {
                subtotal += priceValue * item.quantity;
                totalItemsInCart += item.quantity;
            } else {
                console.warn(`Invalid priceValue for item ${item.id}:`, priceValue);
            }
        });
    }


    const total = subtotal;

    cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
    cartTotalSpan.textContent = `₱${total.toFixed(2)}`;

    return { subtotal, total, totalItemsInCart };
}

// --- Cart Modal Event Listeners ---
cartIconBtn.addEventListener('click', () => {
    cartModal.classList.add('show');
    renderCart(); // Re-render cart every time modal opens to ensure latest state
    robloxUsernameInput.style.display = currentUserId ? 'block' : 'none';
    updateCartCountBadge();
});

closeCartModalBtn.addEventListener('click', () => {
    cartModal.classList.remove('show');
});

cartModal.addEventListener('click', (event) => {
    if (event.target === cartModal) {
        cartModal.classList.remove('show');
    }
});

robloxUsernameInput.addEventListener('input', updateCartCountBadge);

// Handles the process of placing an order.
placeOrderBtn.addEventListener('click', async () => {
    if (cart.length === 0) {
        showMessageBox("Order Error", "Your cart is empty. Please add items before placing an order.");
        return;
    }

    if (!sellerIsOnline) {
        showMessageBox("Order Error", "Cannot place order: The seller is currently offline. Please try again later.");
        return;
    }

    const robloxUsername = robloxUsernameInput.value.trim();

    placeOrderBtn.disabled = true;

    try {
        if (!currentUserId) {
            authModal.classList.add('show');
            authMessage.textContent = "Please login or register to complete your order.";
            authEmailInput.value = "";
            authPasswordInput.value = "";
            placeOrderBtn.disabled = false;
            return;
        }

        if (robloxUsername === '') {
            showMessageBox("Order Error", "Please enter your Roblox Username to proceed with the order.");
            placeOrderBtn.disabled = false;
            return;
        }

        // Recalculate totals right before placing order with latest effective prices
        const { subtotal, total } = calculateCartTotals();
        const orderDetails = {
            userId: currentUserId,
            // Deep copy cart items to ensure order details are immutable if cart changes later
            // Items in cart will have updated effectivePrice from renderCart()
            items: JSON.parse(JSON.stringify(cart)), // Ensure items are stringified inside the order object for safety
            subtotal: subtotal,
            total: total,
            orderDate: new Date().toISOString(),
            status: 'Pending',
            paymentMethod: document.querySelector('input[name="payment-method"]:checked').value,
            robloxUsername: robloxUsername
        };

        console.log("Placing Order:", orderDetails);

        const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUserId));
        const userOrderDocRef = await addDoc(userOrdersColRef, orderDetails);

        const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
        // setDoc here will act as a create if doc does not exist, which is now allowed by rules
        await setDoc(doc(allOrdersColRef, userOrderDocRef.id), orderDetails);

        showMessageBox("Order Placed!", "Successfully Placed Order! You can view it in 'My Orders'.");
        console.log("Order saved to Firestore!");

        cart = [];
        saveCart(); // This will clear the Firestore cart as well
        renderCart();
        cartModal.classList.remove('show');
        robloxUsernameInput.value = '';

    } catch (e) {
        console.error("Error placing order to Firestore:", e);
        showMessageBox("Order Error", "There was an error placing your order. Please try again. " + e.message);
    } finally {
        placeOrderBtn.disabled = false;
    }
});

// --- Order History Functions (User-side) ---
myOrdersButton.addEventListener('click', () => {
    if (!currentUserId) {
        showMessageBox("Login Required", "Please log in to view your order history.");
        return;
    }
    orderHistoryModal.classList.add('show');
    orderHistoryTitle.textContent = "My Orders";
    orderHistoryList.style.display = 'block';
    orderDetailsView.style.display = 'none';
    renderOrderHistory();
});

closeOrderHistoryModalBtn.addEventListener('click', () => {
    orderHistoryModal.classList.remove('show');
});

orderHistoryModal.addEventListener('click', (event) => {
    if (event.target === orderHistoryModal) {
        orderHistoryModal.classList.remove('show');
    }
});

backToOrderListBtn.addEventListener('click', () => {
    orderHistoryList.style.display = 'block';
    orderDetailsView.style.display = 'none';
    orderHistoryTitle.textContent = "My Orders";
    renderOrderHistory();
});

function renderOrderHistory() {
    orderHistoryList.innerHTML = '';

    if (userOrders.length === 0) {
        orderHistoryList.innerHTML = '<p class="empty-message">No orders found.</p>';
        return;
    }

    userOrders.forEach(order => {
        const orderItemDiv = document.createElement('div');
        orderItemDiv.className = 'order-item';
        orderItemDiv.innerHTML = `
            <div class="order-item-info">
                <strong>Order ID: ${order.id.substring(0, 8)}...</strong>
                <span>Date: ${new Date(order.orderDate).toLocaleDateString()}</span>
                <span>Price: ₱${order.total.toFixed(2)}</span>
            </div>
            <span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}}">${order.status}</span>
            <button class="view-details-btn" data-order-id="${order.id}">View Details</button>
        `;
        orderHistoryList.appendChild(orderItemDiv);
    });

    orderHistoryList.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const orderId = event.target.dataset.orderId;
            const selectedOrder = userOrders.find(order => order.id === orderId);
            if (selectedOrder) {
                showOrderDetails(selectedOrder);
            }
        });
    });
}

function showOrderDetails(order) {
    orderHistoryTitle.textContent = "Order Details";
    orderHistoryList.style.display = 'none';
    orderDetailsView.style.display = 'block';

    detailOrderId.textContent = order.id;
    detailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
    detailOrderStatus.textContent = order.status;
    detailOrderStatus.className = `status-info order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;
    detailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
    detailPaymentMethod.textContent = order.paymentMethod;
    detailRobloxUsername.textContent = order.robloxUsername || 'N/A';

    detailItemsList.innerHTML = '';
    if (order.items && Array.isArray(order.items) && order.items.length > 0) { // Added Array.isArray check
        order.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'order-detail-item';
            const imageUrl = `images/${item.image}`;
            // Ensure price is formatted
            const itemPriceFormatted = typeof item.effectivePrice === 'number' ? `₱${item.effectivePrice.toFixed(2)}` : (item.effectivePrice || item.price);
            itemDiv.innerHTML = `
                <span class="order-detail-item-name">${item.name}</span>
                <span class="order-detail-item-qty-price">Qty: ${item.quantity} - ${itemPriceFormatted}</span>
            `;
            detailItemsList.appendChild(itemDiv);
        });
    } else {
        detailItemsList.innerHTML = '<p>No items found for this order.</p>';
    }
}

// --- Product Display Functions (Main Store Page) ---
function renderProducts(items) {
    const list = document.getElementById("product-list");
    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = '<p class="empty-message" style="width: 100%;">No products available. Please add some from the Admin Panel!</p>';
        return;
    }

    items.forEach(product => {
        const card = document.createElement("div");
        card.className = "card";
        const isOutOfStock = !product.stock || product.stock <= 0;
        if (isOutOfStock) card.classList.add("out-of-stock");

        // product.price and product.salePrice are already converted to numbers in setupProductsListener
        const displayPrice = product.sale && typeof product.salePrice === 'number' ?
                                        `<span style="text-decoration: line-through; color: #888; font-size: 0.9em;">₱${product.price.toFixed(2)}</span> ₱${product.salePrice.toFixed(2)}` :
                                        `₱${product.price.toFixed(2)}`;
        const imageUrl = `images/${product.image}`;
        card.innerHTML = `
            ${product.new ? `<span class="badge">NEW</span>` : ""}
            ${product.sale ? `<span class="badge sale" style="${product.new ? 'left: 60px;' : ''}">SALE</span>` : ""}
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/150x150/f0f0f0/888?text=Image%20Not%20Found';" />
            <h4>${product.name}</h4>
            <div class="price">${displayPrice}</div>
            <div class="stock-info ${isOutOfStock ? 'out-of-stock-text' : 'in-stock'}">
                ${isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock}`}
            </div>
            <button class="add-to-cart-btn" ${isOutOfStock ? 'disabled' : ''} data-product-id="${product.id}">
                ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
        `;
        list.appendChild(card);
    });

    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const productToAdd = allProducts.find(p => p.id === productId);
            if (productToAdd) {
                addToCart(productToAdd);
            }
        });
    });
}

function setFilter(category) {
    currentCategory = category;

    document.querySelectorAll(".filters button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.cat === category);
    });

    applyFilters();
}

function applyFilters() {
    const searchBox = document.getElementById("searchBox");
    if (!searchBox) { // Added a check in case searchBox isn't available for some reason
        console.error("Search box element not found.");
        return;
    }
    const query = searchBox.value.toLowerCase();

    const filtered = allProducts.filter(product => {
        const matchesCategory = currentCategory === "all" || product.category === currentCategory;
        const matchesSearch = product.name.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });

    renderProducts(filtered);
}

window.addEventListener("DOMContentLoaded", () => {
    updateCartCountBadge();
    // Initial product rendering is now handled by setupProductsListener
    // Initial auth state check is handled by onAuthStateChanged

    // Attach event listeners for filter buttons
    document.querySelectorAll(".filters button").forEach(button => {
        button.addEventListener("click", (event) => {
            const category = event.target.dataset.cat;
            setFilter(category);
        });
    });

    // Attach event listener for search box
    const searchBox = document.getElementById("searchBox");
    if (searchBox) {
        searchBox.addEventListener("input", applyFilters);
    }

    // Payment method preview image change
    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const selected = document.querySelector('input[name="payment-method"]:checked').value.toLowerCase();
            const img = document.getElementById('payment-preview-img');
            // Ensure the image source matches your file names (e.g., "gcash.png", "maya.png", "paypal.png")
            img.src = `images/${selected}.png`;
        });
    });
});

