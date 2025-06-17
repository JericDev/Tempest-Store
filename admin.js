// script.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
// IMPORTANT: Ensure this configuration matches your Firebase project's config.
const firebaseConfig = {
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

// Global variables to store unsubscribe functions for real-time listeners
let unsubscribeUserOrders = null;
let unsubscribeProducts = null;
// Unsubscribe for allOrders will be handled in admin.js

// Reference to the admin panel initialization function from admin.js
let initAdminPanelModule = null;
let adminCleanupFunction = null;

// --- DOM elements for Authentication ---
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const registerButton = document.getElementById("register-button");
const loginButton = document.getElementById("login-button");
const loginRegisterButton = document.getElementById("login-register-button"); 
const logoutButton = document.getElementById("logout-button");
const myOrdersButton = document.getElementById("my-orders-button");
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

// --- DOM elements for Custom Message Modal (Replaces alert/confirm) ---
const messageModal = document.getElementById('message-modal');
const messageModalTitle = document.getElementById('message-modal-title');
const messageModalText = document.getElementById('message-modal-text');
const closeMessageModalBtn = document.getElementById('close-message-modal');
const messageModalActions = document.getElementById('message-modal-actions');

/**
 * Displays a custom message modal to the user, replacing native `alert()`.
 * @param {string} title - The title of the message.
 * @param {string} message - The content of the message.
 * @param {string} [type='info'] - Type of message ('info', 'success', 'error').
 * @param {function} [onConfirm=null] - Callback function for a confirm action (optional).
 * @param {function} [onCancel=null] - Callback function for a cancel action (optional).
 */
function showMessage(title, message, type = 'info', onConfirm = null, onCancel = null) {
    messageModalTitle.textContent = title;
    messageModalText.textContent = message;
    messageModalActions.innerHTML = ''; // Clear previous buttons

    // Add CSS class based on message type for styling (e.g., color)
    messageModal.className = `modal ${type}`;

    if (onConfirm) {
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'OK';
        confirmBtn.className = 'button confirm-button';
        confirmBtn.addEventListener('click', () => {
            hideMessage();
            onConfirm();
        });
        messageModalActions.appendChild(confirmBtn);
        // If a confirm button is present, also add a cancel button if no explicit onCancel is provided,
        // so the user always has a way to close the confirm dialog without action.
        if (!onCancel) {
             const cancelBtn = document.createElement('button');
             cancelBtn.textContent = 'Cancel';
             cancelBtn.className = 'button';
             cancelBtn.addEventListener('click', hideMessage);
             messageModalActions.appendChild(cancelBtn);
        }
    } else {
        // If no confirm action, just an OK button to close
        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.className = 'button';
        okBtn.addEventListener('click', hideMessage);
        messageModalActions.appendChild(okBtn);
    }

    if (onCancel) {
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'button';
        cancelBtn.addEventListener('click', () => {
            hideMessage();
            onCancel(); // Call the explicit cancel callback
        });
        // Ensure cancel button is added only once if both onConfirm and onCancel are provided
        if (!onConfirm || (onConfirm && !messageModalActions.querySelector('.button:last-child').textContent.includes('Cancel'))) {
            messageModalActions.appendChild(cancelBtn);
        }
    }

    messageModal.classList.add('show');
}

/**
 * Hides the custom message modal.
 */
function hideMessage() {
    messageModal.classList.remove('show');
    // Clean up type class
    messageModal.className = 'modal'; 
}

// Close message modal via 'X' button
if (closeMessageModalBtn) {
    closeMessageModalBtn.addEventListener('click', hideMessage);
}

// Close message modal if clicked outside content
if (messageModal) {
    messageModal.addEventListener('click', (event) => {
        if (event.target === messageModal) {
            hideMessage();
        }
    });
}


// --- Authentication Functions ---
registerButton.addEventListener("click", async () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) {
        authMessage.textContent = "Please enter email and password.";
        authMessage.style.color = 'red'; 
        return; 
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        authMessage.textContent = `Registered and logged in as: ${userCredential.user.email}`;
        authMessage.style.color = 'green'; 
        console.log("User registered:", userCredential.user.email);
        authModal.classList.remove('show'); 
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            authMessage.textContent = "Registration failed: This email is already in use. Try logging in.";
        } else if (error.code === 'auth/weak-password') {
            authMessage.textContent = "Registration failed: Password should be at least 6 characters.";
        } else if (error.code === 'auth/invalid-email') {
            authMessage.textContent = "Registration failed: The email address is not valid.";
        } else {
            authMessage.textContent = `Registration failed: ${error.message}`; 
        }
        authMessage.style.color = 'red'; 
        console.error("Registration error:", error); 
    }
});

loginButton.addEventListener("click", async () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) { 
        authMessage.textContent = "Please enter email and password."; 
        authMessage.style.color = 'red'; 
        return; 
    }
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        authMessage.textContent = `Logged in as: ${userCredential.user.email}`;
        authMessage.style.color = 'green'; 
        console.log("User logged in:", userCredential.user.email);
        authModal.classList.remove('show'); 
    } catch (error) { 
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
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        authMessage.textContent = "Logged out successfully.";
        authMessage.style.color = 'green'; 
        console.log("User logged out.");
    } catch (error) { 
        authMessage.textContent = `Logout failed: ${error.message}`; 
        authMessage.style.color = 'red'; 
        console.error("Logout error:", error); 
    }
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
forgotPasswordButton.addEventListener('click', async () => {
    const email = authEmailInput.value.trim();
    if (!email) {
        authMessage.textContent = "Please enter your email to reset your password.";
        authMessage.style.color = 'red';
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        authMessage.textContent = `Password reset email sent to ${email}. Check your inbox!`;
        authMessage.style.color = 'green';
        authEmailInput.value = ""; 
        authPasswordInput.value = ""; 
    } catch (error) {
        switch (error.code) {
            case 'auth/invalid-email':
                authMessage.textContent = "Password reset failed: The email address is not valid.";
                break;
            case 'auth/user-not-found':
                authMessage.textContent = "Password reset failed: No user found with that email address.";
                break;
            default:
                authMessage.textContent = `Password reset failed: ${error.message}`;
        }
        authMessage.style.color = 'red';
        console.error("Password reset error:", error);
    }
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

        userDisplay.textContent = `Welcome, ${user.email}`;
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
                    showMessage('Error', 'Failed to load admin panel. Please check admin.js.', 'error');
                }
            }
            if (initAdminPanelModule) {
                // Pass Firestore and Auth instances, plus user info to admin module
                initAdminPanelModule(db, auth, currentUserId, isAdmin);
            }
        } else {
            adminPanelButton.style.display = "none";
        }
        
        robloxUsernameInput.style.display = "block"; 
        
        await loadCartFromFirestore(currentUserId); 
        await syncCartOnLogin(currentUserId); 

        // Set up listener for user's order history
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
    // Clear auth fields and message on state change
    authEmailInput.value = "";
    authPasswordInput.value = "";
    authMessage.textContent = "";
    authMessage.style.color = 'red'; 
    renderCart(); 
    // Products are always rendered via the setupProductsListener called globally.
});

// --- Firestore Collection Paths ---
const APP_ID = 'tempest-store-app'; 
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`; 
const USER_CARTS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/carts`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`; 

// --- Product Display (Accessible to all) ---
/**
 * Sets up a real-time listener for products in Firestore and renders them.
 * This listener is active regardless of user authentication status.
 */
function setupProductsListener() {
    const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
    return onSnapshot(productsColRef, (snapshot) => { 
        const fetchedProducts = [];
        snapshot.forEach(doc => {
            fetchedProducts.push({ id: doc.id, ...doc.data() });
        });
        allProducts = fetchedProducts; 
        renderProducts(allProducts); 
        // Re-render cart on product changes to update prices in case of sale updates
        renderCart();
    }, (error) => {
        console.error("Error listening to products:", error);
        showMessage('Error', 'Failed to load products. Please try again later.', 'error');
    });
}

// Call setupProductsListener once when the script loads to always show products
unsubscribeProducts = setupProductsListener();

// --- Cart Persistence (Customer-side) ---
/**
 * Saves the current cart data to Firestore for the given user ID.
 * @param {string} userId - The ID of the current user.
 * @param {Array} cartData - The cart array to save.
 */
async function saveCartToFirestore(userId, cartData) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        // Firestore doesn't directly support nested arrays or complex objects beyond simple maps and arrays of primitives.
        // Stringify the cartData to store it as a single string.
        await setDoc(userCartRef, { items: JSON.stringify(cartData) }); 
        console.log("Cart saved to Firestore for user:", userId);
    } catch (e) {
        console.error("Error saving cart to Firestore:", e);
        showMessage('Error', 'Failed to save cart to cloud. Please check your internet connection.', 'error');
    }
}

/**
 * Loads the cart data from Firestore for the given user ID.
 * @param {string} userId - The ID of the current user.
 */
async function loadCartFromFirestore(userId) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        const docSnap = await getDoc(userCartRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            cart = JSON.parse(data.items || '[]'); 
            console.log("Cart loaded from Firestore for user:", userId, cart);
        } else {
            cart = []; 
            console.log("No cart found in Firestore for user:", userId);
        }
    } catch (e) {
        console.error("Error loading cart from Firestore:", e);
        cart = []; // Ensure cart is empty on error to prevent bad data
        showMessage('Error', 'Failed to load cart from cloud. It might be empty or corrupted.', 'error');
    }
}

/**
 * Saves the cart data to local storage.
 * @param {Array} cartData - The cart array to save.
 */
function saveCartToLocalStorage(cartData) {
    try {
        localStorage.setItem('tempestStoreCart', JSON.stringify(cartData));
    } catch (e) {
        console.error("Error saving cart to local storage:", e);
    }
}

/**
 * Loads the cart data from local storage.
 * @returns {Array} The cart array loaded from local storage, or an empty array if not found.
 */
function loadCartFromLocalStorage() {
    try {
        const storedCart = localStorage.getItem('tempestStoreCart');
        return storedCart ? JSON.parse(storedCart) : [];
    } catch (e) {
        console.error("Error loading cart from local storage:", e);
        return []; // Return empty cart on error
    }
}

/**
 * Syncs the local storage cart with the Firestore cart upon user login.
 * Merges items, prioritizing Firestore and updating quantities/prices.
 * @param {string} userId - The ID of the logged-in user.
 */
async function syncCartOnLogin(userId) {
    const localCart = loadCartFromLocalStorage();
    if (localCart.length > 0) {
        try {
            const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
            const docSnap = await getDoc(userCartRef);
            let firestoreCart = [];
            if (docSnap.exists()) {
                firestoreCart = JSON.parse(docSnap.data().items || '[]');
            }

            localCart.forEach(localItem => {
                const existingItemIndex = firestoreCart.findIndex(item => item.id === localItem.id);
                if (existingItemIndex > -1) {
                    firestoreCart[existingItemIndex].quantity += localItem.quantity;
                } else {
                    // When syncing, ensure effectivePrice is correctly set based on current product data.
                    const productDetails = allProducts.find(p => p.id === localItem.id);
                    if (productDetails) {
                        const priceToUse = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                        firestoreCart.push({ ...localItem, effectivePrice: priceToUse });
                    } else {
                        // Fallback if product not found (e.g., deleted by admin), retain existing price
                        firestoreCart.push(localItem);
                    }
                }
            });
            cart = firestoreCart; 
            await saveCartToFirestore(userId, cart); 
            localStorage.removeItem('tempestStoreCart'); // Clear local storage after sync
            renderCart(); 
        } catch (e) {
            console.error("Error syncing cart on login:", e);
            showMessage('Error', 'Failed to synchronize your local cart with your account.', 'error');
        }
    }
}

// --- Customer Order History (User-side) ---
/**
 * Sets up a real-time listener for the current user's order history from Firestore.
 * Sorts orders by date in descending order (newest first) client-side.
 * @param {string} userId - The ID of the current user.
 * @returns {function} An unsubscribe function to stop listening to updates.
 */
function setupUserOrderHistoryListener(userId) {
    const ordersCollectionRef = collection(db, USER_ORDERS_COLLECTION_PATH(userId));
    // Removed orderBy to avoid index issues; sorting will be done client-side.
    const q = ordersCollectionRef; 
    return onSnapshot(q, (snapshot) => { 
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            fetchedOrders.push({ id: doc.id, ...doc.data() });
        });
        // Sort orders by orderDate in descending order (newest first) client-side
        userOrders = fetchedOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)); 
        renderOrderHistory(); 
    }, (error) => {
        console.error("Error listening to user order history:", error);
        showMessage('Error', 'Failed to load your order history. Please try again.', 'error');
    });
}

// --- Cart Management Functions ---
/**
 * Adds a product to the cart or increases its quantity if already present.
 * @param {Object} product - The product object to add.
 */
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        // Ensure effectivePrice is based on product's current sale status/price
        const productDetails = allProducts.find(p => p.id === product.id);
        const priceToUse = productDetails && productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
        cart.push({ ...product, quantity: 1, effectivePrice: priceToUse }); 
    }
    saveCart(); 
    renderCart(); 
    console.log("Cart contents:", cart);
}

/**
 * Removes a product entirely from the cart.
 * @param {string} productId - The ID of the product to remove.
 */
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart(); 
    renderCart(); 
}

/**
 * Updates the quantity of a specific product in the cart.
 * Ensures quantity is at least 1.
 * @param {string} productId - The ID of the product to update.
 * @param {number} newQuantity - The new quantity for the product.
 */
function updateCartQuantity(productId, newQuantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = Math.max(1, newQuantity); // Ensure quantity is never less than 1
        saveCart(); 
        renderCart(); 
    }
}

/**
 * Saves the current cart data either to Firestore (if logged in) or local storage.
 */
function saveCart() {
    if (currentUserId) {
        saveCartToFirestore(currentUserId, cart);
    } else {
        saveCartToLocalStorage(cart);
    }
    updateCartCountBadge(); 
}

/**
 * Updates the cart count badge and the "Place Order" button text/disabled state.
 */
function updateCartCountBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountBadge.textContent = totalItems;
    cartCountBadge.style.display = totalItems > 0 ? 'inline-block' : 'none'; 

    const { total } = calculateCartTotals();
    placeOrderBtn.textContent = `Place Order (${totalItems} item${totalItems !== 1 ? 's' : ''}) ₱${total.toFixed(2)}`;
    
    // Disable place order button if cart is empty OR (user is logged in AND Roblox username is empty)
    placeOrderBtn.disabled = totalItems === 0 || (currentUserId && robloxUsernameInput.value.trim() === '');
}

/**
 * Renders the items currently in the cart within the cart modal.
 * Updates item prices based on the latest `allProducts` data.
 */
function renderCart() {
    cartItemsContainer.innerHTML = ''; 

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
    } else {
        cart.forEach(item => {
            // Find the latest product details from allProducts to ensure accurate price
            const productDetails = allProducts.find(p => p.id === item.id);
            let priceToDisplay;
            if (productDetails) {
                priceToDisplay = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                // Update item's effectivePrice in cart to match latest product data
                item.effectivePrice = priceToDisplay; 
            } else {
                // Fallback if product is no longer found (e.g., deleted by admin)
                // Use the last known effective price or original price
                priceToDisplay = item.effectivePrice || item.price;
            }

            const imageUrl = `images/${item.image}`; // Assuming images are in an 'images' folder
            const cartItemDiv = document.createElement('div'); 
            cartItemDiv.className = 'cart-item';
            cartItemDiv.innerHTML = `
                <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/f0f0f0/888?text=Image%20N/A';" />
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <div class="cart-item-price">₱${parseFloat(priceToDisplay).toFixed(2)}</div>
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

        // Add event listeners for quantity controls and remove buttons
        cartItemsContainer.querySelectorAll('.cart-item-quantity-control button').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.dataset.id;
                const action = event.target.dataset.action;
                const input = event.target.parentElement.querySelector('input');
                let newQuantity = parseInt(input.value);

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
    }

    calculateCartTotals(); 
    updateCartCountBadge(); 
}

/**
 * Calculates the subtotal and total for items in the cart.
 * Updates the corresponding DOM elements.
 * @returns {Object} An object containing subtotal, total, and totalItemsInCart.
 */
function calculateCartTotals() {
    let subtotal = 0;
    let totalItemsInCart = 0;
    cart.forEach(item => {
        // Use the effectivePrice from the cart item, which is updated in renderCart()
        // or fall back to item.price if effectivePrice isn't set (shouldn't happen with updated logic)
        const priceValue = parseFloat(item.effectivePrice); 
        if (!isNaN(priceValue)) { // Ensure priceValue is a valid number
            subtotal += priceValue * item.quantity;
        }
        totalItemsInCart += item.quantity;
    });

    const total = subtotal; // Assuming no other charges for now (e.g., shipping, tax)

    cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
    cartTotalSpan.textContent = `₱${total.toFixed(2)}`;

    return { subtotal, total, totalItemsInCart }; 
}

// --- Cart Modal Event Listeners ---
cartIconBtn.addEventListener('click', () => {
    cartModal.classList.add('show');
    renderCart();
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

/**
 * Handles the process of placing an order.
 * Validates cart and user input, then saves the order to Firestore.
 */
placeOrderBtn.addEventListener('click', async () => {
    if (cart.length === 0) {
        showMessage("Empty Cart", "Your cart is empty. Please add items before placing an order.", 'info');
        return;
    }

    const robloxUsername = robloxUsernameInput.value.trim();

    // Disable button and add loading indicator
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'Placing Order...';

    try {
        if (!currentUserId) {
            authModal.classList.add('show');
            authMessage.textContent = "Please login or register to complete your order.";
            authEmailInput.value = ""; 
            authPasswordInput.value = ""; 
            placeOrderBtn.disabled = false; 
            placeOrderBtn.textContent = `Place Order (${calculateCartTotals().totalItemsInCart} items) ₱${calculateCartTotals().total.toFixed(2)}`;
            return; 
        }
        
        if (robloxUsername === '') {
            showMessage("Roblox Username Required", "Please enter your Roblox Username to proceed with the order.", 'warning');
            placeOrderBtn.disabled = false; 
            placeOrderBtn.textContent = `Place Order (${calculateCartTotals().totalItemsInCart} items) ₱${calculateCartTotals().total.toFixed(2)}`;
            return; 
        }

        // Recalculate totals right before placing order with latest effective prices
        const { subtotal, total } = calculateCartTotals(); 
        const orderDetails = {
            userId: currentUserId,
            // Deep copy cart items to ensure order details are immutable if cart changes later
            items: JSON.parse(JSON.stringify(cart)), 
            subtotal: subtotal,
            total: total,
            orderDate: new Date().toISOString(), // Store as ISO string for consistent sorting
            status: 'Pending', 
            paymentMethod: document.querySelector('input[name="payment-method"]:checked')?.value || 'Cash On Delivery', // Fallback
            robloxUsername: robloxUsername 
        };

        console.log("Placing Order:", orderDetails);

        // Add to user's specific orders collection
        const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUserId));
        const userOrderDocRef = await addDoc(userOrdersColRef, orderDetails);

        // Also add to a central 'allOrders' collection for admin view
        const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
        // Using setDoc with the same ID ensures both collections have the same order ID
        await setDoc(doc(allOrdersColRef, userOrderDocRef.id), orderDetails); 

        showMessage("Order Placed!", "Your order has been successfully placed!", 'success'); 
        console.log("Order saved to Firestore!");
        
        // Clear cart and update UI
        cart = [];
        saveCart(); // Save empty cart
        renderCart(); // Re-render cart UI
        cartModal.classList.remove('show'); // Close cart modal
        robloxUsernameInput.value = ''; // Clear username input

    } catch (e) {
        console.error("Error placing order to Firestore:", e);
        showMessage("Order Error", "There was an error placing your order. Please try again.", 'error');
    } finally {
        // Re-enable button and reset text
        placeOrderBtn.disabled = false; 
        updateCartCountBadge(); // Reset button text based on current cart
    }
});


// --- Order History Functions (User-side) ---
myOrdersButton.addEventListener('click', () => {
    if (!currentUserId) {
        showMessage("Login Required", "Please log in to view your order history.", 'info'); 
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
    renderOrderHistory(); // Re-render the list to ensure it's up to date
});

/**
 * Renders the user's order history list in the order history modal.
 */
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
            <span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-') || 'pending'}">${order.status}</span>
            <button class="view-details-btn" data-order-id="${order.id}">View Details</button>
        `;                    
        orderHistoryList.appendChild(orderItemDiv);
    });

    orderHistoryList.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const orderId = event.target.dataset.orderId;
            showOrderDetails(orderId);
        });
    });
}

/**
 * Displays the detailed view of a specific order.
 * @param {string} orderId - The ID of the order to display.
 */
function showOrderDetails(orderId) {
    const order = userOrders.find(o => o.id === orderId);
    if (!order) {
        showMessage('Error', 'Order details not found.', 'error');
        return;
    }

    orderHistoryTitle.textContent = `Order Details: ${order.id.substring(0, 8)}...`;
    orderHistoryList.style.display = 'none';
    orderDetailsView.style.display = 'block';

    detailOrderId.textContent = order.id;
    detailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
    detailOrderStatus.className = `status-${order.status.toLowerCase().replace(/\s/g, '-') || 'pending'}`;
    detailOrderStatus.textContent = order.status;
    detailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
    detailPaymentMethod.textContent = order.paymentMethod;
    detailRobloxUsername.textContent = order.robloxUsername;

    detailItemsList.innerHTML = '';
    order.items.forEach(item => {
        const li = document.createElement('li');
        // Ensure price formatting is consistent, handling potential string prices
        const itemPrice = parseFloat(item.effectivePrice || item.price).toFixed(2);
        li.textContent = `${item.name} (x${item.quantity}) - ₱${itemPrice} each`;
        detailItemsList.appendChild(li);
    });
}

// Function to render products on the main page (assuming you have a products-container in your HTML)
// This function needs to be correctly integrated with your main HTML structure.
function renderProducts(products) {
    const productsContainer = document.getElementById('products-container'); // Assuming this ID exists
    if (!productsContainer) {
        console.warn("Products container not found. Ensure an element with id 'products-container' exists.");
        return;
    }

    productsContainer.innerHTML = ''; // Clear existing products

    if (products.length === 0) {
        productsContainer.innerHTML = '<p class="empty-message">No products available at the moment.</p>';
        return;
    }

    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        const imageUrl = `images/${product.image}`; // Adjust path as needed
        const priceDisplay = product.sale && product.salePrice 
            ? `<span class="original-price">₱${product.price.toFixed(2)}</span> <span class="sale-price">₱${parseFloat(product.salePrice).toFixed(2)}</span>`
            : `₱${parseFloat(product.price).toFixed(2)}`;

        productCard.innerHTML = `
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/150x150/f0f0f0/888?text=Image%20N/A';">
            <h3>${product.name}</h3>
            <p class="product-description">${product.description || ''}</p>
            <div class="product-price">${priceDisplay}</div>
            <button class="add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>
        `;
        productsContainer.appendChild(productCard);
    });

    productsContainer.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const productToAdd = allProducts.find(p => p.id === productId);
            if (productToAdd) {
                addToCart(productToAdd);
                showMessage('Item Added', `${productToAdd.name} added to cart!`, 'success');
            } else {
                showMessage('Error', 'Product not found. Please try again.', 'error');
            }
        });
    });
}

// Initial render of cart (will be empty until products/user state loads)
renderCart();

// Export the showMessage function so it can be imported by other modules (e.g., admin.js)
export { showMessage };
