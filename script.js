// script.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

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
let currentProductStocks = {}; // NEW: Global map to store product ID to its current stock
let sellerIsOnline = false; // Global variable for seller status

// Global variables to store unsubscribe functions for real-time listeners
let unsubscribeUserOrders = null;
let unsubscribeProducts = null;
let unsubscribeSiteSettings = null;

// Reference to the admin panel initialization and cleanup functions from admin.js
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
const forgotPasswordButton = document.getElementById("forgot-password-button");


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
const paymentPreviewImg = document.getElementById('payment-preview-img');


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

// --- NEW: DOM elements for Filters and Search ---
const filterButtons = document.querySelectorAll(".filters button");
const searchBox = document.getElementById("searchBox");
let currentCategory = 'all'; // Global variable for filtering

// --- NEW: DOM elements for Seller Status ---
const sellerStatusDisplay = document.getElementById("seller-status-display");


// --- Custom Alert/Confirm Modals (replacing native alert/confirm) ---
function showCustomAlert(message) {
    const alertModal = document.createElement('div');
    alertModal.className = 'custom-modal';
    alertModal.innerHTML = `
        <div class="custom-modal-content">
            <span class="custom-modal-close-btn">&times;</span>
            <p>${message}</p>
            <button class="custom-modal-ok-btn" style="background-color: #007bff; color: white;">OK</button>
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

function showCustomConfirm(message, onConfirm) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'custom-modal';
    confirmModal.innerHTML = `
        <div class="custom-modal-content">
            <span class="custom-modal-close-btn">&times;</span>
            <p>${message}</p>
            <div class="custom-modal-buttons">
                <button class="custom-modal-confirm-btn" style="background-color: #28a745; color: white;">Yes</button>
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

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        onConfirm();
        closeModal();
    });
    confirmModal.addEventListener('click', (event) => {
        if (event.target === confirmModal) {
            closeModal();
        }
    });

    setTimeout(() => confirmModal.classList.add('show'), 10);
}


// --- Firestore Collection Paths ---
const APP_ID = 'tempest-store-app';
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const USER_CARTS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/carts`;
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;
const SITE_SETTINGS_COLLECTION_PATH = `artifacts/${APP_ID}/settings`;


// --- Authentication Functions ---
registerButton.addEventListener("click", () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) { showCustomAlert("Please enter email and password."); return; }
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            authMessage.textContent = `Registered and logged in as: ${userCredential.user.email}`;
            authMessage.style.color = 'green';
            console.log("User registered:", userCredential.user.email);
            authModal.classList.remove('show');
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                showCustomAlert("Registration failed: This email is already in use. Try logging in.");
            } else {
                showCustomAlert(`Registration failed: ${error.message}`);
            }
            console.error("Registration error:", error);
        });
});

loginButton.addEventListener("click", () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    if (!email || !password) { showCustomAlert("Please enter email and password."); return; }
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
                    showCustomAlert("Login failed: Invalid email or password.");
                    break;
                case 'auth/invalid-email':
                    showCustomAlert("Login failed: The email address is not valid.");
                    break;
                case 'auth/user-disabled':
                    showCustomAlert("Login failed: This account has been disabled.");
                    break;
                default:
                    showCustomAlert(`Login failed: ${error.message}`);
            }
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
            showCustomAlert(`Logout failed: ${error.message}`);
            console.error("Logout error:", error);
        });
});

loginRegisterButton.addEventListener('click', () => {
    authModal.classList.add('show');
    authMessage.textContent = "";
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
        showCustomAlert("Please enter your email to reset your password.");
        return;
    }

    sendPasswordResetEmail(auth, email)
        .then(() => {
            showCustomAlert(`Password reset email sent to ${email}. Check your inbox!`);
            authEmailInput.value = "";
            authPasswordInput.value = "";
        })
        .catch((error) => {
            switch (error.code) {
                case 'auth/invalid-email':
                    showCustomAlert("Password reset failed: The email address is not valid.");
                    break;
                case 'auth/user-not-found':
                    showCustomAlert("Password reset failed: No user found with that email address.");
                    break;
                default:
                    showCustomAlert(`Password reset failed: ${error.message}`);
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

        robloxUsernameInput.style.display = "block"; // Show Roblox input for logged-in users

        await loadCartFromFirestore(currentUserId);
        await syncCartOnLogin(currentUserId); // Sync local cart with Firestore cart
        updateCartUI(); // Update UI after loading/syncing cart

        unsubscribeUserOrders = setupUserOrderHistoryListener(currentUserId);

    } else {
        currentUserId = null;
        isAdmin = false;

        userDisplay.textContent = "";
        loginRegisterButton.style.display = "inline-block";
        logoutButton.style.display = "none";
        myOrdersButton.style.display = "none";
        adminPanelButton.style.display = "none";

        robloxUsernameInput.style.display = "none"; // Hide Roblox input for logged-out users

        cart = loadCartFromLocalStorage(); // Load local cart for guest users
        userOrders = [];
        updateCartUI(); // Update UI for guest users
    }
    authEmailInput.value = "";
    authPasswordInput.value = "";
    authMessage.textContent = "";
});


// --- Product Display (Accessible to all) ---
function setupProductsListener() {
    // Unsubscribe from previous listener if it exists to prevent duplicates
    if (unsubscribeProducts) {
        unsubscribeProducts();
    }

    const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
    // Order products for consistent display.
    // NOTE: If you enable sorting in Firestore queries (e.g., orderBy("name")),
    // you might need to create an index in Firebase Console if you get an error.
    // For client-side sorting, you can remove orderBy from the query and sort `fetchedProducts` array directly.
    const q = query(productsColRef);

    unsubscribeProducts = onSnapshot(q, (snapshot) => {
        const fetchedProducts = [];
        const newProductStocks = {}; // Temporary map for current stocks
        snapshot.forEach(doc => {
            const productData = { id: doc.id, ...doc.data() };
            fetchedProducts.push(productData);
            newProductStocks[productData.id] = productData.stock; // Populate stock map
        });

        allProducts = fetchedProducts; // Update your global allProducts array
        currentProductStocks = newProductStocks; // Update the global stock map

        console.log("Fetched Products from Firestore:", allProducts);
        applyFilters(); // Re-render the main product list after products are fetched and updated
        updateCartUI(); // Re-evaluate cart display based on new stock
    }, (error) => {
        console.error("Error listening to products:", error);
    });
}

// Call setupProductsListener once when the script loads to always show products
setupProductsListener();


// --- Site Settings Listener and Functions ---
function setupSiteSettingsListener() {
    // Listen to a specific document (e.g., 'global') in the settings collection
    const settingsDocRef = doc(db, SITE_SETTINGS_COLLECTION_PATH, 'global');
    return onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            sellerIsOnline = data.sellerOnline || false; // Default to offline if not set
            updateSellerStatusDisplay();
        } else {
            console.log("No 'global' settings document found. Initializing with default status.");
            // If document doesn't exist, create it with default status
            setDoc(settingsDocRef, { sellerOnline: false })
                .then(() => {
                    sellerIsOnline = false;
                    updateSellerStatusDisplay();
                })
                .catch(error => {
                    console.error("Error creating initial site settings:", error);
                });
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
    updateCartUI(); // Re-evaluate place order button state based on seller status
}

// Function to be called by admin.js to update seller status in Firestore
async function toggleSellerStatus(isOnline) {
    try {
        const settingsDocRef = doc(db, SITE_SETTINGS_COLLECTION_PATH, 'global');
        await updateDoc(settingsDocRef, { sellerOnline: isOnline });
        console.log("Seller status updated to:", isOnline);
    } catch (e) {
        console.error("Error updating seller status:", e);
        showCustomAlert("Error updating seller status: " + e.message);
    }
}

// Call setupSiteSettingsListener once when the script loads
unsubscribeSiteSettings = setupSiteSettingsListener();


// --- Cart Persistence (Customer-side) ---
async function saveCartToFirestore(cartData) {
    try {
        const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(currentUserId), 'currentCart');
        await setDoc(userCartRef, { items: JSON.stringify(cartData) });
        console.log("Cart saved to Firestore for user:", currentUserId);
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
    } catch (e) {
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
                // Combine quantities, but respect available stock
                const availableStock = currentProductStocks[localItem.id] !== undefined ? currentProductStocks[localItem.id] : 0;
                firestoreCart[existingItemIndex].quantity = Math.min(firestoreCart[existingItemIndex].quantity + localItem.quantity, availableStock);
            } else {
                const productDetails = allProducts.find(p => p.id === localItem.id);
                if (productDetails) {
                    const priceToUse = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                    const availableStock = currentProductStocks[productDetails.id] !== undefined ? currentProductStocks[productDetails.id] : 0;
                    // Add new item, but only up to available stock
                    firestoreCart.push({ ...localItem, effectivePrice: priceToUse, quantity: Math.min(localItem.quantity, availableStock) });
                } else {
                    // Fallback if product not found (e.g., deleted by admin), add with original quantity
                    firestoreCart.push(localItem);
                }
            }
        });
        cart = firestoreCart.filter(item => item.quantity > 0); // Remove items with 0 quantity after sync
        await saveCartToFirestore(userId, cart);
        localStorage.removeItem('tempestStoreCart');
        updateCartUI();
    }
}


// --- Cart Management Functions ---
// Renamed from renderCart to updateCartUI to better reflect its purpose
function updateCartUI() {
    cartItemsContainer.innerHTML = '';
    let subtotal = 0;
    let totalItemsInCart = 0;
    let canPlaceOrder = true; // Flag to check if order can be placed

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        cartCountBadge.textContent = '0';
        cartCountBadge.style.display = 'none';
        cartSubtotalSpan.textContent = '₱0.00';
        cartTotalSpan.textContent = '₱0.00';
        placeOrderBtn.textContent = `Place Order (0 items) ₱0.00`;
        placeOrderBtn.disabled = true;
        placeOrderBtn.title = "Your cart is empty.";
        robloxUsernameInput.style.display = currentUserId ? 'block' : 'none'; // Keep input visibility consistent with auth state
        return;
    }

    robloxUsernameInput.style.display = currentUserId ? 'block' : 'none'; // Show/hide based on login status

    cart.forEach(item => {
        // Get the latest product details from allProducts for price, image, and initial stock
        const productDetails = allProducts.find(p => p.id === item.id);
        const latestPrice = productDetails && productDetails.sale && productDetails.salePrice ? productDetails.salePrice : (productDetails ? productDetails.price : item.effectivePrice);
        const currentStock = currentProductStocks[item.id] !== undefined ? currentProductStocks[item.id] : 0; // Use currentProductStocks for live stock

        // Update item's effectivePrice in cart based on latest product data
        if (productDetails) {
            item.effectivePrice = latestPrice;
        }

        const itemTotal = parseFloat(item.effectivePrice.replace('₱', '')) * item.quantity;
        subtotal += itemTotal;
        totalItemsInCart += item.quantity;

        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'cart-item';

        let stockStatusMessage = '';
        let stockIssue = false; // Flag to indicate if there's a stock issue for this item

        if (currentStock === 0) {
            stockStatusMessage = '<span class="status-offline">Out of Stock!</span>';
            stockIssue = true;
            item.quantity = 0; // Force quantity to 0 if out of stock
        } else if (currentStock < item.quantity) {
            stockStatusMessage = `<span class="status-pending">Only ${currentStock} in stock! Quantity adjusted.</span>`;
            stockIssue = true;
            item.quantity = currentStock; // Adjust cart quantity to available stock
        }

        if (stockIssue) {
            canPlaceOrder = false; // If any item has a stock issue, cannot place order
        }

        const imageUrl = `images/${item.image}`;
        cartItemDiv.innerHTML = `
            <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/f0f0f0/888?text=Image%20N/A';" />
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <div class="cart-item-price">${latestPrice}</div>
            </div>
            <div class="cart-item-quantity-control">
                <button data-id="${item.id}" data-action="decrease">-</button>
                <input type="number" value="${item.quantity}" min="0" data-id="${item.id}" readonly>
                <button data-id="${item.id}" data-action="increase" ${currentStock <= item.quantity ? 'disabled' : ''}>+</button>
            </div>
            <button class="cart-item-remove" data-id="${item.id}">&times;</button>
            ${stockStatusMessage ? `<p class="stock-status-message">${stockStatusMessage}</p>` : ''}
        `;
        cartItemsContainer.appendChild(cartItemDiv);
    });

    // Re-filter cart to remove items with quantity 0 after adjustments
    cart = cart.filter(item => item.quantity > 0);
    saveCart(); // Save the adjusted cart (after quantity updates from stock checks)

    // Event listeners for quantity controls and remove button
    cartItemsContainer.querySelectorAll('.cart-item-quantity-control button').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.id;
            const action = event.target.dataset.action;
            const item = cart.find(i => i.id === productId);
            if (!item) return;

            let newQuantity = item.quantity;
            const maxStock = currentProductStocks[productId] !== undefined ? currentProductStocks[productId] : 0;

            if (action === 'increase') {
                newQuantity = Math.min(newQuantity + 1, maxStock);
            } else if (action === 'decrease') {
                newQuantity = Math.max(0, newQuantity - 1);
            }
            updateCartQuantity(productId, newQuantity); // This will call updateCartUI again
        });
    });

    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.id;
            removeFromCart(productId); // This will call updateCartUI again
        });
    });

    // Re-calculate totals after potentially adjusting quantities
    const finalTotals = calculateCartTotals();
    cartSubtotalSpan.textContent = `₱${finalTotals.subtotal.toFixed(2)}`;
    cartTotalSpan.textContent = `₱${finalTotals.total.toFixed(2)}`;
    cartCountBadge.textContent = finalTotals.totalItemsInCart;
    cartCountBadge.style.display = finalTotals.totalItemsInCart > 0 ? 'inline-block' : 'none';

    // Determine final canPlaceOrder status
    canPlaceOrder = canPlaceOrder && finalTotals.totalItemsInCart > 0 && sellerIsOnline;
    placeOrderBtn.disabled = !canPlaceOrder;

    if (!sellerIsOnline) {
        placeOrderBtn.title = "Cannot place order: Seller is currently offline.";
    } else if (finalTotals.totalItemsInCart === 0) {
        placeOrderBtn.title = "Your cart is empty.";
    } else if (!canPlaceOrder) {
        placeOrderBtn.title = "Cannot place order: Some items in your cart are out of stock or exceed available quantity.";
    } else if (currentUserId && robloxUsernameInput.value.trim() === '') {
        placeOrderBtn.title = "Please enter your Roblox Username.";
        placeOrderBtn.disabled = true; // Also disable if username is missing for logged-in user
    } else {
        placeOrderBtn.title = ""; // Clear tooltip
    }

    placeOrderBtn.textContent = `Place Order (${finalTotals.totalItemsInCart} item${finalTotals.totalItemsInCart !== 1 ? 's' : ''}) ₱${finalTotals.total.toFixed(2)}`;
}


function addToCart(productId) {
    const productToAdd = allProducts.find(p => p.id === productId);
    if (!productToAdd) {
        showCustomAlert("Product not found.");
        return;
    }

    // Get the latest stock for this product
    const availableStock = currentProductStocks[productId] !== undefined ? currentProductStocks[productId] : 0;

    const existingCartItem = cart.find(item => item.id === productId);

    if (existingCartItem) {
        if (existingCartItem.quantity + 1 > availableStock) {
            showCustomAlert(`Cannot add more "${productToAdd.name}". Only ${availableStock} available in stock.`);
            return;
        }
        existingCartItem.quantity++;
    } else {
        if (availableStock === 0) {
            showCustomAlert(`"${productToAdd.name}" is currently out of stock.`);
            return;
        }
        // If adding a new item, ensure it's not more than available stock (should be 1 unless quantity field allows more)
        const quantityToAdd = 1; // Assuming adding one at a time from product list
        if (quantityToAdd > availableStock) {
            showCustomAlert(`Cannot add "${productToAdd.name}". Only ${availableStock} available in stock.`);
            return;
        }

        // Use the current price/salePrice from the fetched product
        const effectivePrice = productToAdd.sale && productToAdd.salePrice ? productToAdd.salePrice : productToAdd.price;

        cart.push({
            id: productToAdd.id,
            name: productToAdd.name,
            price: productToAdd.price,
            effectivePrice: effectivePrice, // Store the price at time of adding to cart
            image: productToAdd.image,
            quantity: quantityToAdd
        });
    }

    saveCart(); // This calls saveCartToFirestore/LocalStorage and updateCartUI
    showCustomAlert(`${productToAdd.name} added to cart!`);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI(); // Explicitly call to update cart display
}

function updateCartQuantity(productId, newQuantity) {
    const item = cart.find(item => item.id === productId);
    const maxStock = currentProductStocks[productId] !== undefined ? currentProductStocks[productId] : 0;

    if (item) {
        // Ensure new quantity does not exceed available stock and is not negative
        newQuantity = Math.max(0, Math.min(newQuantity, maxStock));
        item.quantity = newQuantity;
        
        // If quantity becomes 0, remove the item from cart
        if (item.quantity === 0) {
            cart = cart.filter(i => i.id !== productId);
        }
        saveCart();
        updateCartUI(); // This will re-render and re-evaluate place order button
    }
}

function saveCart() {
    if (currentUserId) {
        saveCartToFirestore(currentUserId, cart);
    } else {
        saveCartToLocalStorage(cart);
    }
    // updateCartUI() is called after saveCart in most places,
    // or by the product listener, so no need to call it here again.
}

function calculateCartTotals() {
    let subtotal = 0;
    let totalItemsInCart = 0;
    cart.forEach(item => {
        const priceValue = parseFloat((item.effectivePrice || item.price || "₱0.00").replace('₱', ''));
        subtotal += priceValue * item.quantity;
        totalItemsInCart += item.quantity;
    });

    const total = subtotal;
    return { subtotal, total, totalItemsInCart };
}

// --- Cart Modal Event Listeners ---
cartIconBtn.addEventListener('click', () => {
    cartModal.classList.add('show');
    updateCartUI(); // Ensure cart UI is updated every time it opens
});

closeCartModalBtn.addEventListener('click', () => {
    cartModal.classList.remove('show');
});

cartModal.addEventListener('click', (event) => {
    if (event.target === cartModal) {
        cartModal.classList.remove('show');
    }
});

robloxUsernameInput.addEventListener('input', updateCartUI); // Re-evaluate place order button on input change


// Handles the process of placing an order.
placeOrderBtn.addEventListener('click', async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        showCustomAlert("Please login or register to complete your order.");
        authModal.classList.add('show');
        return;
    }

    if (cart.length === 0) {
        showCustomAlert("Your cart is empty. Please add items before placing an order.");
        return;
    }

    if (!sellerIsOnline) {
        showCustomAlert("Cannot place order: The seller is currently offline. Please try again later.");
        return;
    }

    const robloxUsername = robloxUsernameInput.value.trim();
    if (robloxUsername === '') {
        showCustomAlert("Please enter your Roblox Username to proceed with the order.");
        return;
    }

    // Perform a final check of stock before attempting transaction (for immediate user feedback)
    let preflightStockCheckPassed = true;
    for (const item of cart) {
        const availableStock = currentProductStocks[item.id] !== undefined ? currentProductStocks[item.id] : 0;
        if (item.quantity === 0 || availableStock === 0 || item.quantity > availableStock) {
            preflightStockCheckPassed = false;
            showCustomAlert(`Order failed: "${item.name}" is out of stock or quantity exceeds available stock (${availableStock}). Please review your cart.`);
            updateCartUI(); // Refresh cart UI to show exact issue
            return;
        }
    }
    if (!preflightStockCheckPassed) {
        return; // Should be caught by the above alert, but a safeguard.
    }

    showCustomConfirm("Are you sure you want to place this order?", async () => {
        placeOrderBtn.disabled = true; // Disable button immediately to prevent double clicks
        try {
            // Use a Firestore Transaction for Atomicity
            // This ensures stock updates are safe even with multiple simultaneous orders
            await runTransaction(db, async (transaction) => {
                const purchasedItems = [];
                for (const item of cart) {
                    const productRef = doc(db, PRODUCTS_COLLECTION_PATH, item.id);
                    const productDoc = await transaction.get(productRef); // Get latest product data within the transaction

                    if (!productDoc.exists()) {
                        throw new Error(`Product "${item.name}" no longer exists or was deleted.`);
                    }

                    const currentStock = productDoc.data().stock || 0; // Default to 0 if stock field is missing
                    if (currentStock < item.quantity) {
                        // This is crucial: if stock is insufficient during the transaction,
                        // abort the order and notify the user.
                        throw new Error(`Insufficient stock for "${item.name}". Only ${currentStock} available.`);
                    }

                    const newStock = currentStock - item.quantity;
                    transaction.update(productRef, { stock: newStock }); // Deduct stock

                    // Store the item details at the time of purchase, including its effective price
                    purchasedItems.push({
                        id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        image: item.image,
                        price: item.price, // Original price (for record)
                        effectivePrice: item.effectivePrice // Price paid (might be sale price)
                    });
                }

                // If all stock checks pass, proceed to save the order
                const { total } = calculateCartTotals(); // Recalculate one last time
                const orderData = {
                    userId: currentUser.uid,
                    robloxUsername: robloxUsername,
                    items: purchasedItems, // Use the prepared purchasedItems array
                    total: total,
                    paymentMethod: document.querySelector('input[name="payment-method"]:checked').value,
                    orderDate: new Date().toISOString(), // Use ISO string for consistency
                    status: "Pending"
                };

                // Add to user-specific orders subcollection
                const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUser.uid));
                const newOrderRef = doc(userOrdersColRef); // Firestore generates ID for user-specific order
                transaction.set(newOrderRef, orderData);

                // Also add to the 'allOrders' collection for admin view
                const allOrdersRef = doc(db, ALL_ORDERS_COLLECTION_PATH, newOrderRef.id);
                transaction.set(allOrdersRef, orderData);
            });

            // If the transaction completes successfully:
            cart = []; // Clear the local cart
            await saveCartToFirestore([]); // Clear cart in Firestore
            robloxUsernameInput.value = ''; // Clear Roblox username input
            updateCartUI(); // Update UI
            showCustomAlert("Order placed successfully! Thank you for your purchase.");
            cartModal.classList.remove('show');

        } catch (error) {
            console.error("Error placing order:", error);
            showCustomAlert("Failed to place order: " + error.message);
        } finally {
            placeOrderBtn.disabled = false; // Re-enable button regardless of outcome
        }
    });
});


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

        const displayPrice = product.sale && product.salePrice ?
                                    `<span style="text-decoration: line-through; color: #888; font-size: 0.9em;">${product.price}</span> ${product.salePrice}` :
                                    product.price;
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
            addToCart(productId);
        });
    });
}

function setFilter(category) {
    currentCategory = category;

    filterButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.cat === category);
    });

    applyFilters();
}

function applyFilters() {
    // Check if searchBox exists (it might not be rendered on initial load if #product-list is empty)
    if (!searchBox) {
        console.warn("Search box element not found for filtering.");
        // If search box is not found, just render all products filtered by category
        const filteredByCategory = allProducts.filter(product => {
            return currentCategory === "all" || product.category === currentCategory;
        });
        renderProducts(filteredByCategory);
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

// Attach event listeners for filter buttons
filterButtons.forEach(button => {
    button.addEventListener("click", (event) => {
        const category = event.target.dataset.cat;
        setFilter(category);
    });
});

// Attach event listener for search box
if (searchBox) {
    searchBox.addEventListener("input", applyFilters);
}

// Payment method preview image change
document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const selected = document.querySelector('input[name="payment-method"]:checked').value.toLowerCase();
        // Ensure the image source matches your file names (e.g., "gcash.png", "maya.png", "paypal.png")
        paymentPreviewImg.src = `images/${selected}.png`;
    });
});
