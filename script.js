// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js"; // Added writeBatch

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
// NEW: DOM elements for payment contact details
const paymentContactNumberSpan = document.getElementById("payment-contact-number");
const copyContactNumberBtn = document.getElementById("copy-contact-number-btn");


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

// --- Custom Alert/Confirm Modals ---
// Function to show a custom alert modal instead of native alert()
function showCustomAlert(message) {
    const alertModal = document.createElement('div');
    alertModal.className = 'custom-modal';
    alertModal.innerHTML = `
        <div class="custom-modal-content">
            <span class="custom-modal-close-btn">&times;</span>
            <p>${message}</p>
            <button class="custom-modal-ok-btn">OK</button>
        </div>
    `;
    document.body.appendChild(alertModal);

    const closeBtn = alertModal.querySelector('.custom-modal-close-btn');
    const okBtn = alertModal.querySelector('.custom-modal-ok-btn');

    const closeModal = () => {
        alertModal.classList.remove('show');
        setTimeout(() => alertModal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', closeModal);
    alertModal.addEventListener('click', (event) => {
        if (event.target === alertModal) {
            closeModal();
        }
    });

    setTimeout(() => alertModal.classList.add('show'), 10);
}

// Function to show a custom confirmation modal instead of native confirm()
function showCustomConfirm(message, onConfirm, onCancel = () => {}) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'custom-modal';
    confirmModal.innerHTML = `
        <div class="custom-modal-content">
            <span class="custom-modal-close-btn">&times;</span>
            <p>${message}</p>
            <div class="custom-modal-buttons">
                <button class="custom-modal-confirm-btn">Yes</button>
                <button class="custom-modal-cancel-btn">No</button>
            </div>
        </div>
    `;
    document.body.appendChild(confirmModal);

    const closeBtn = confirmModal.querySelector('.custom-modal-close-btn');
    const confirmBtn = confirmModal.querySelector('.custom-modal-confirm-btn');
    const cancelBtn = confirmModal.querySelector('.custom-modal-cancel-btn');

    const closeModal = () => {
        confirmModal.classList.remove('show');
        setTimeout(() => confirmModal.remove(), 300);
    };

    closeBtn.addEventListener('click', () => { closeModal(); onCancel(); });
    cancelBtn.addEventListener('click', () => { closeModal(); onCancel(); });
    confirmBtn.addEventListener('click', () => {
        onConfirm();
        closeModal();
    });
    confirmModal.addEventListener('click', (event) => {
        if (event.target === confirmModal) {
            closeModal();
            onCancel();
        }
    });

    setTimeout(() => confirmModal.classList.add('show'), 10);
}


// --- Authentication Functions ---
registerButton.addEventListener("click", () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) { authMessage.textContent = "Please enter email and password."; return; }
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
    if (!email || !password) { authMessage.textContent = "Please enter email and password."; return; }
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
    cartModal.classList.remove('show'); // Make sure cart modal is closed if auth is opened from it
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
        authMessage.textContent = "Please enter your email to reset your password.";
        authMessage.style.color = 'red';
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => {
            authMessage.textContent = `Password reset email sent to ${email}. Check your inbox!`;
            authMessage.style.color = 'green';
            authEmailInput.value = "";
            authPasswordInput.value = "";
        })
        .catch((error) => {
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
    renderCart(); // Re-render cart after auth state changes to reflect stock adjustments or pricing for guest
    // Products are always rendered via the setupProductsListener called globally.
});

// --- Firestore Collection Paths ---
const APP_ID = 'tempest-store-app';
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
            fetchedProducts.push({ id: doc.id, ...doc.data() });
        });
        allProducts = fetchedProducts;
        console.log("Fetched Products from Firestore:", allProducts); // Added for debugging
        applyFilters(); // Call applyFilters after products are fetched and updated
        renderCart(); // Also re-render the cart to update any stock-related warnings/quantity adjustments
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
    return onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            sellerIsOnline = data.sellerOnline || false; // Default to offline if not set
            updateSellerStatusDisplay();
            // Removed updateCartCountBadge() call from here as it's not needed for seller status
        } else {
            console.log("No 'global' settings document found. Initializing with default status.");
            // If document doesn't exist, create it with default status
            setDoc(settingsDocRef, { sellerOnline: false });
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
        showCustomAlert("Error updating seller status: " + e.message); // Using custom alert
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
    }
}

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
    }
    catch (e) {
        console.error("Error loading cart from Firestore:", e);
        cart = [];
    }
}

function saveCartToLocalStorage(cartData) {
    localStorage.setItem('tempestStoreCart', JSON.stringify(cartData));
}

function loadCartFromLocalStorage() {
    const storedCart = localStorage.getItem('tempestStoreCart');
    return storedCart ? JSON.parse(storedCart) : [];
}

async function syncCartOnLogin(userId) {
    const localCart = loadCartFromLocalStorage();
    if (localCart.length > 0) {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
        const docSnap = await getDoc(userCartRef);
        let firestoreCart = [];
        if (docSnap.exists()) {
            firestoreCart = JSON.parse(docSnap.data().items || '[]');
        }

        localCart.forEach(localItem => {
            const existingItemIndex = firestoreCart.findIndex(item => item.id === localItem.id);
            if (existingItemIndex > -1) {
                // Merge quantity if item exists, ensuring it doesn't exceed current stock
                const productDetails = allProducts.find(p => p.id === localItem.id);
                if (productDetails) {
                    const combinedQuantity = firestoreCart[existingItemIndex].quantity + localItem.quantity;
                    firestoreCart[existingItemIndex].quantity = Math.min(combinedQuantity, productDetails.stock || 0);
                    // Update effectivePrice in case product details changed
                    const priceToUse = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                    firestoreCart[existingItemIndex].effectivePrice = priceToUse;
                } else {
                    // If product no longer exists, remove it or set quantity to 0
                    firestoreCart[existingItemIndex].quantity = 0; // Effectively remove from consideration
                }
            } else {
                // Add new item, checking stock
                const productDetails = allProducts.find(p => p.id === localItem.id);
                if (productDetails && productDetails.stock > 0) {
                    const priceToUse = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                    firestoreCart.push({ ...localItem, quantity: Math.min(localItem.quantity, productDetails.stock), effectivePrice: priceToUse });
                } else {
                    // If product not found or out of stock, do not add from local storage
                    console.warn(`Product ${localItem.name} not found or out of stock during sync, not adding from local storage.`);
                }
            }
        });
        // Now, we do NOT filter out items with 0 quantity here, allowing them to remain in the cart for visual display.
        cart = firestoreCart;  
        await saveCartToFirestore(userId, cart);
        localStorage.removeItem('tempestStoreCart');
        renderCart();
    }
}

// --- Customer Order History (User-side) ---
function setupUserOrderHistoryListener(userId) {
    const ordersCollectionRef = collection(db, USER_ORDERS_COLLECTION_PATH(userId));
    const q = query(ordersCollectionRef, orderBy("orderDate", "desc"));
    return onSnapshot(q, (snapshot) => {
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            fetchedOrders.push({ id: doc.id, ...doc.data() });
        });
        userOrders = fetchedOrders;
        renderOrderHistory();
    }, (error) => {
        console.error("Error listening to user order history:", error);
    });
}

// --- Cart Management Functions ---
function addToCart(product) {
    const productDetails = allProducts.find(p => p.id === product.id);
    if (!productDetails || productDetails.stock <= 0) {
        showCustomAlert(`${product.name} is currently out of stock.`);
        return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        if (existingItem.quantity < productDetails.stock) {
            existingItem.quantity++;
            showCustomAlert(`Added another ${product.name} to cart. Total: ${existingItem.quantity}`);
        } else {
            showCustomAlert(`Cannot add more ${product.name}. Max stock reached: ${productDetails.stock}.`);
            return; // Don't save/render if no change
        }
    } else {
        // Ensure effectivePrice is based on product's current sale status/price
        const priceToUse = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
        cart.push({ ...product, quantity: 1, effectivePrice: priceToUse });
        showCustomAlert(`Added ${product.name} to cart.`);
    }
    saveCart();
    renderCart();
    console.log("Cart contents:", cart);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
    showCustomAlert("Item removed from cart.");
}

function updateCartQuantity(productId, newQuantity) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        const productDetails = allProducts.find(p => p.id === productId);
        const currentStock = productDetails ? productDetails.stock : 0;

        if (newQuantity <= 0) {
            // Set quantity to 0 and visually mark as out of stock/disabled
            cart[itemIndex].quantity = 0;
        } else if (newQuantity > currentStock) {
            cart[itemIndex].quantity = currentStock; // Cap quantity at available stock
            if (currentStock === 0) { // Should be covered by newQuantity <= 0, but as safeguard
                cart[itemIndex].quantity = 0;
            } else {
                showCustomAlert(`Cannot set quantity for ${cart[itemIndex].name} to ${newQuantity}. Only ${currentStock} available. Quantity adjusted.`);
            }
        } else {
            cart[itemIndex].quantity = newQuantity;
        }
        saveCart();
        renderCart();
    }
}

function saveCart() {
    if (currentUserId) {
        saveCartToFirestore(currentUserId, cart);
    } else {
        saveCartToLocalStorage(cart);
    }
    updateCartCountBadge();
}

function updateCartCountBadge() {
    // The badge should show the count of unique items in the cart,
    // regardless of their current stock quantity.
    const totalDistinctItemsInCart = cart.length;

    // Get the actual countable items for the place order button and total.
    const { total, itemsWithZeroQuantity, totalItemsInCart } = calculateCartTotals(); 

    cartCountBadge.textContent = totalDistinctItemsInCart;
    cartCountBadge.style.display = totalDistinctItemsInCart > 0 ? 'inline-block' : 'none';

    // The place order button text should still reflect only items that can be ordered
    placeOrderBtn.textContent = `Place Order (${totalItemsInCart} item${totalItemsInCart !== 1 ? 's' : ''}) ₱${total.toFixed(2)}`;

    // Disable place order button if cart is effectively empty (no items with >0 quantity),
    // Roblox username not entered (if logged in), or if there are items with zero quantity.
    placeOrderBtn.disabled = totalItemsInCart === 0 || (currentUserId && robloxUsernameInput.value.trim() === '') || itemsWithZeroQuantity > 0;

    // Optional: Add a tooltip or message if disabled due to seller being offline
    if (itemsWithZeroQuantity > 0) {
        placeOrderBtn.title = "Cannot place order: Some items in your cart are out of stock.";
    } else if (robloxUsernameInput.value.trim() === '' && currentUserId) {
        placeOrderBtn.title = "Please enter your Roblox Username.";
    } else if (totalItemsInCart === 0) {
        placeOrderBtn.title = "Your cart is empty.";
    } else {
        placeOrderBtn.title = ""; // Clear tooltip
    }
}

function renderCart() {
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
    } else {
        const itemsToRender = []; // Use this to collect items before filtering
        cart.forEach(item => {
            const productDetails = allProducts.find(p => p.id === item.id);
            let priceToDisplay;
            let currentStock = productDetails ? productDetails.stock : 0;
            let itemStatusMessage = '';
            let isItemOutOfStock = false;

            // Logic to adjust quantity and set status based on current stock
            if (productDetails) {
                if (currentStock === 0) { // If product is truly out of stock
                    item.quantity = 0; // Force quantity to 0
                    isItemOutOfStock = true;
                    itemStatusMessage = '<div class="cart-item-out-of-stock-message">Out of Stock!</div>'; // New div for message
                } else if (item.quantity > currentStock) { // If user has more than available stock
                    item.quantity = currentStock; // Cap quantity at available stock
                    itemStatusMessage = `<div class="cart-item-status-message">Qty adjusted (Max: ${currentStock})</div>`; // New div for message
                }
                priceToDisplay = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                item.effectivePrice = priceToDisplay; // Update item's effectivePrice in cart to match latest
            } else {
                // Product no longer exists (deleted by admin or sync issue)
                item.quantity = 0; // Set quantity to 0
                isItemOutOfStock = true;
                itemStatusMessage = '<div class="cart-item-out-of-stock-message">Product Not Found / Out of Stock!</div>'; // New div for message
                priceToDisplay = item.effectivePrice || item.price || '₱0.00'; // Fallback price
            }

            // Always add the item to itemsToRender, regardless of its quantity, to keep it in the cart visually
            itemsToRender.push(item);

            const imageUrl = `images/${item.image}`;
            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            if (isItemOutOfStock) {
                cartItemDiv.classList.add('out-of-stock-cart-item');
            }
            cartItemDiv.innerHTML = `
                <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/f0f0f0/888?text=Image%20N/A';" />
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    ${itemStatusMessage} <!-- Display the status message here -->
                    <div class="cart-item-price">${priceToDisplay}</div>
                </div>
                <div class="cart-item-quantity-control">
                    <button data-id="${item.id}" data-action="decrease" ${isItemOutOfStock || item.quantity === 0 ? 'disabled' : ''}>-</button>
                    <input type="number" value="${item.quantity}" min="0" data-id="${item.id}" ${isItemOutOfStock ? 'readonly' : ''}>
                    <button data-id="${item.id}" data-action="increase" ${isItemOutOfStock || item.quantity >= currentStock ? 'disabled' : ''}>+</button>
                </div>
                <button class="cart-item-remove" data-id="${item.id}">&times;
            `;
            cartItemsContainer.appendChild(cartItemDiv);
        });

        // Update the global cart with the (potentially adjusted) items. This now explicitly includes
        // items with quantity 0, as per your request to keep them visually in the cart.
        cart = itemsToRender;  
        saveCart(); // This will persist the quantity adjustments in Firestore/Local Storage

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

        cartItemsContainer.querySelectorAll('.cart-item-quantity-control input[type="number"]').forEach(input => {
            input.addEventListener('change', (event) => {
                const productId = event.target.dataset.id;
                const newQuantity = parseInt(event.target.value);
                updateCartQuantity(productId, newQuantity);
            });
        });


        cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.dataset.id;
                showCustomConfirm("Are you sure you want to remove this item from your cart?", () => {
                    removeFromCart(productId);
                });
            });
        });
    }

    calculateCartTotals();
    updateCartCountBadge(); // This will also disable the place order button if hasOutOfStockItems is true
}

function calculateCartTotals() {
    let subtotal = 0;
    let totalItemsInCart = 0;
    let itemsWithZeroQuantity = 0; // New: Counter for items forced to 0 quantity

    cart.forEach(item => {
        // Only count items with quantity > 0 for calculating totals and for the totalItemsInCart count
        if (item.quantity > 0) {  
            const priceValue = parseFloat((item.effectivePrice || item.price).replace('₱', ''));
            subtotal += priceValue * item.quantity;
            totalItemsInCart += item.quantity;
        } else {
            // Count items that are in the cart array but have a quantity of 0
            itemsWithZeroQuantity++;  
        }
    });

    const total = subtotal;

    cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
    cartTotalSpan.textContent = `₱${total.toFixed(2)}`;

    return { subtotal, total, totalItemsInCart, itemsWithZeroQuantity };
}

// --- Cart Modal Event Listeners ---
cartIconBtn.addEventListener('click', () => {
    cartModal.classList.add('show');
    renderCart(); // Call renderCart to ensure stock checks are done before showing
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

// NEW: Event listener for the Copy button
copyContactNumberBtn.addEventListener('click', () => {
    console.log("Copy button clicked."); // Debugging: Check if this logs for admin
    const contactNumber = paymentContactNumberSpan.textContent;
    const tempInput = document.createElement('textarea'); // Use textarea for multi-line support / better copy behavior
    tempInput.value = contactNumber;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand('copy');
        showCustomAlert("Number copied to clipboard!");
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showCustomAlert("Failed to copy number. Please copy it manually.");
    }
    document.body.removeChild(tempInput);
});


// Handles the process of placing an order.
placeOrderBtn.addEventListener('click', async () => {
    if (cart.length === 0) {
        showCustomAlert("Your cart is empty. Please add items before placing an order.");
        return;
    }

    const { totalItemsInCart, itemsWithZeroQuantity } = calculateCartTotals();
    if (itemsWithZeroQuantity > 0) {
        showCustomAlert("Cannot place order: Some items in your cart are out of stock or quantities were adjusted. Please review your cart.");
        return;
    }

    const robloxUsername = robloxUsernameInput.value.trim();

    if (!currentUserId) {
        showCustomAlert("Please login or register to complete your order.");
        authModal.classList.add('show'); // Open auth modal
        authMessage.textContent = "Please login or register to complete your order.";
        authEmailInput.value = "";
        authPasswordInput.value = "";
        return;
    }

    if (robloxUsername === '') {
        showCustomAlert("Please enter your Roblox Username to proceed with the order.");
        return;
    }

    placeOrderBtn.disabled = true; // Disable button immediately to prevent double clicks

    const batch = writeBatch(db); // Initialize a new batch for atomic updates
    let orderCanProceed = true;
    let outOfStockProductNames = [];
    const productSnapshots = new Map(); // Store product data fetched in the first loop

    // First, verify stock for all items within the transaction
    for (const item of cart) {
        // Skip stock verification for items that are already 0 quantity in cart
        if (item.quantity === 0) {
            continue;  
        }

        const productRef = doc(db, PRODUCTS_COLLECTION_PATH, item.id);
        const productSnap = await getDoc(productRef); // Get latest product data
        
        if (!productSnap.exists()) {
            orderCanProceed = false;
            outOfStockProductNames.push(`${item.name} (Product Not Found)`);
            break;
        }

        const productData = productSnap.data();
        productSnapshots.set(item.id, productData); // Store the fetched product data
        const availableStock = productData.stock || 0;

        if (item.quantity > availableStock) {
            orderCanProceed = false;
            outOfStockProductNames.push(`${item.name} (Only ${availableStock} left)`);
            break;
        }
    }

    if (!orderCanProceed) {
        showCustomAlert(`Order cannot be placed due to insufficient stock for: ${outOfStockProductNames.join(', ')}. Please adjust your cart.`);
        placeOrderBtn.disabled = false;
        return;
    }

    try {
        // If all checks pass, proceed with deducting stock and creating order
        for (const item of cart) {
            // Only deduct stock for items with quantity > 0
            if (item.quantity > 0) {
                const productRef = doc(db, PRODUCTS_COLLECTION_PATH, item.id);
                const productDataForUpdate = productSnapshots.get(item.id); // Retrieve the stored product data
                if (productDataForUpdate) { // Defensive check
                    batch.update(productRef, {
                        stock: productDataForUpdate.stock - item.quantity  
                    });
                }
            }
        }

        // Recalculate totals right before placing order with latest effective prices
        const { subtotal, total } = calculateCartTotals();
        const orderDetails = {
            userId: currentUserId,
            // Deep copy cart items to ensure order details are immutable if cart changes later
            // IMPORTANT: Filter out items with 0 quantity from the order details themselves.
            items: JSON.parse(JSON.stringify(cart.filter(item => item.quantity > 0))),  
            subtotal: subtotal,
            total: total,
            orderDate: new Date().toISOString(),
            status: 'Pending',
            paymentMethod: document.querySelector('input[name="payment-method"]:checked').value,
            robloxUsername: robloxUsername
        };

        console.log("Placing Order:", orderDetails);

        const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUserId));
        // Add to user-specific collection
        const newUserOrderRef = doc(userOrdersColRef); // Create a new document reference with an auto-generated ID
        batch.set(newUserOrderRef, orderDetails); // Use set for new document

        const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
        // SetDoc here will act as a create if doc does not exist, which is now allowed by rules
        batch.set(doc(allOrdersColRef, newUserOrderRef.id), orderDetails); // Use same ID for allOrders

        await batch.commit(); // Commit all batch operations atomically

        showCustomAlert("Successfully Placed Order! Your stock has been deducted.");
        console.log("Order saved to Firestore and stock deducted!");

        cart = []; // Clear cart after successful order
        saveCart(); // This will clear local storage/Firestore cart and update badge
        cartModal.classList.remove('show');
        robloxUsernameInput.value = '';

    } catch (e) {
        console.error("Error placing order and deducting stock:", e);
        showCustomAlert("There was an error placing your order or deducting stock. Please try again. Error: " + e.message);
    } finally {
        placeOrderBtn.disabled = false; // Re-enable button
    }
});

// --- Order History Functions (User-side) ---
myOrdersButton.addEventListener('click', () => {
    if (!currentUserId) {
        showCustomAlert("Please log in to view your order history.");
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
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'order-detail-item';
            const imageUrl = `images/${item.image}`;
            itemDiv.innerHTML = `
                <span class="order-detail-item-name">${item.name}</span>
                <span class="order-detail-item-qty-price">Qty: ${item.quantity} - ${item.effectivePrice || item.price}</span>
            `;
            detailItemsList.appendChild(itemDiv);
        });
    } else {
        detailItemsList.innerHTML = '<p>No items found for this order.</p>';
    }
}

// --- Product Display Functions (Main Store Page) ---
const productListElement = document.getElementById("product-list"); // Rename for clarity

function renderProducts(items) {
    productListElement.innerHTML = ""; // Use the renamed element

    if (items.length === 0) {
        productListElement.innerHTML = '<p class="empty-message" style="width: 100%;">No products available. Please add some from the Admin Panel!</p>';
        return;
    }

    items.forEach(product => {
        const card = document.createElement("div");
        card.className = "card";
        const isOutOfStock = !product.stock || product.stock <= 0;
        if (isOutOfStock) card.classList.add("out-of-stock");

        const displayPrice = product.sale && product.salePrice ?
                                        `<span style="text-decoration: line-through; color: #888; font-size: 0.9em;">${product.price}</span> ${product.salePrice}` :
                                        product.price;
        const imageUrl = `images/${product.image}`;
        card.innerHTML = `
            ${product.new ? `<span class="badge">NEW</span>` : ""}
            ${product.sale ? `<span class="badge sale" style="${product.new ? 'left: 60px;' : ''}">SALE</span>` : ""}
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/150x150/f0f0f0/888?text=Image%20N/A';" />
            <h4>${product.name}</h4>
            <div class="price">${displayPrice}</div>
            <div class="stock-info ${isOutOfStock ? 'out-of-stock-text' : 'in-stock'}">
                ${isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock}`}
            </div>
            <button class="add-to-cart-btn" ${isOutOfStock ? 'disabled' : ''} data-product-id="${product.id}">
                ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
        `;
        productListElement.appendChild(card);
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
