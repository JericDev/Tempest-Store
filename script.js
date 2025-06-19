// Import necessary Firebase functions
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp // Import serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import admin-specific functions from admin.js
import { initAdminPanel, cleanupAdminPanel } from './admin.js';

// --- Firebase Initialization and Global Variables ---
let app;
let db;
let auth;
let currentUserId = null; // To store the authenticated user's ID
let unsubscribeProductListener; // To store the unsubscribe function for products
let unsubscribeUserOrderListener; // To store the unsubscribe function for user-specific orders
let unsubscribeCartListener; // New: Unsubscribe function for user's cart
let unsubscribeStoreSettingsListener; // To store the unsubscribe function for store settings

// Explicitly define appId to match Firebase rules' getAppId() function
const appId = "tempest-store-app";
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Initialize Firebase
if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Sign in anonymously or with custom token
    if (typeof __initial_auth_token !== 'undefined') {
        signInWithCustomToken(auth, __initial_auth_token)
            .then(() => {
                console.log('Signed in with custom token.');
            })
            .catch((error) => {
                console.error('Error signing in with custom token:', error);
                // Fallback to anonymous if custom token fails
                signInAnonymously(auth)
                    .then(() => console.log('Signed in anonymously.'))
                    .catch((anonError) => console.error('Error signing in anonymously:', anonError));
            });
    } else {
        signInAnonymously(auth)
            .then(() => console.log('Signed in anonymously.'))
            .catch((error) => console.error('Error signing in anonymously:', error));
    }
} else {
    console.error("Firebase config is not provided. Firebase will not be initialized.");
}

// --- Auth State Change Listener ---
onAuthStateChanged(auth, (user) => {
    const userDisplay = document.getElementById('user-display');
    const loginRegisterButton = document.getElementById('login-register-button');
    const logoutButton = document.getElementById('logout-button');
    const myOrdersButton = document.getElementById('my-orders-button');
    const adminPanelButton = document.getElementById('admin-panel-button');

    if (user) {
        currentUserId = user.uid;
        userDisplay.textContent = `Welcome, User ${user.uid.substring(0, 8)}...`; // Displaying a truncated user ID
        loginRegisterButton.style.display = 'none';
        logoutButton.style.display = 'inline-block';
        myOrdersButton.style.display = 'inline-block';

        // Check if the user is an admin
        checkAdminStatus(user.uid).then(isAdmin => {
            if (isAdmin) {
                adminPanelButton.style.display = 'inline-block';
                // Initialize admin panel functions from admin.js
                initAdminPanel(db, auth, user.uid, isAdmin, updateStoreSettings, getStoreSettingsValue);
                // Also listen for store settings here for the main display
                listenForStoreSettings();
            } else {
                adminPanelButton.style.display = 'none';
                // Cleanup admin panel if no longer admin or logged out
                cleanupAdminPanel();
                if (unsubscribeStoreSettingsListener) {
                    unsubscribeStoreSettingsListener();
                }
            }
        });

        // Start real-time listeners for products, user-specific orders, and user cart
        listenForProducts();
        listenForUserOrders(user.uid);
        listenForCart(user.uid); // New: Listen for user's cart in Firestore
    } else {
        currentUserId = null;
        userDisplay.textContent = '';
        loginRegisterButton.style.display = 'inline-block';
        logoutButton.style.display = 'none';
        myOrdersButton.style.display = 'none';
        adminPanelButton.style.display = 'none';

        // Clear products and orders display when logged out
        renderProducts([]);
        document.getElementById('order-history-list').innerHTML = '<p class="empty-message">No orders found.</p>';
        
        // Unsubscribe from real-time updates when logged out
        if (unsubscribeProductListener) {
            unsubscribeProductListener();
        }
        if (unsubscribeUserOrderListener) {
            unsubscribeUserOrderListener();
        }
        if (unsubscribeCartListener) { // New: Unsubscribe from cart listener
            unsubscribeCartListener();
        }
        if (unsubscribeStoreSettingsListener) {
            unsubscribeStoreSettingsListener();
        }

        // Cleanup admin panel if user logs out
        cleanupAdminPanel();

        // Clear local cart state and update display
        cartItems = []; // Clear in-memory cart
        updateCartDisplay();
        document.getElementById('place-order-btn').textContent = 'Place Order (0 items) ₱0.00';
    }
});

// --- Admin Status Check ---
async function checkAdminStatus(uid) {
    // Admin ID is hardcoded in rules for simplicity
    return uid === "LigBezoWV9eVo8lglsijoWinKmA2";
}

// --- Modals and UI Elements (Only those used directly by script.js) ---
const authModal = document.getElementById('auth-modal');
const closeAuthModalBtn = document.getElementById('close-auth-modal');
const loginRegisterButton = document.getElementById('login-register-button');
const registerButton = document.getElementById('register-button');
const loginButton = document.getElementById('login-button');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authMessage = document.getElementById('auth-message');
const logoutButton = document.getElementById('logout-button');
const forgotPasswordButton = document.getElementById('forgot-password-button');

const cartModal = document.getElementById('cart-modal');
const cartIconButton = document.getElementById('cart-icon-btn');
const closeCartModalBtn = document.getElementById('close-cart-modal');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartCountBadge = document.getElementById('cart-count');
const cartSubtotalSpan = document.getElementById('cart-subtotal');
const cartTotalSpan = document.getElementById('cart-total');
const placeOrderBtn = document.getElementById('place-order-btn');
const robloxUsernameInput = document.getElementById('roblox-username-input');

const orderHistoryModal = document.getElementById('order-history-modal');
const myOrdersButton = document.getElementById('my-orders-button');
const closeOrderHistoryModalBtn = document.getElementById('close-order-history-modal');
const orderHistoryList = document.getElementById('order-history-list');
const orderDetailsView = document.getElementById('order-details-view');
const backToOrderListBtn = document.getElementById('back-to-order-list');

const sellerStatusDisplay = document.getElementById('seller-status-display'); // For the main page display


// --- Event Listeners ---
loginRegisterButton.addEventListener('click', () => {
    authModal.classList.add('show');
    authMessage.textContent = ''; // Clear previous messages
});
closeAuthModalBtn.addEventListener('click', () => authModal.classList.remove('show'));

registerButton.addEventListener('click', handleRegister);
loginButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', handleLogout);
forgotPasswordButton.addEventListener('click', handleForgotPassword);

cartIconButton.addEventListener('click', () => {
    cartModal.classList.add('show');
    updateCartDisplay(); // Refresh cart display whenever modal is opened
});
closeCartModalBtn.addEventListener('click', () => cartModal.classList.remove('show'));

placeOrderBtn.addEventListener('click', placeOrder);

myOrdersButton.addEventListener('click', () => {
    orderHistoryModal.classList.add('show');
    displayUserOrders(); // Display user's orders when modal is opened
});
closeOrderHistoryModalBtn.addEventListener('click', () => {
    orderHistoryModal.classList.remove('show');
    // Hide details view and show list when closing modal
    orderDetailsView.style.display = 'none';
    orderHistoryList.style.display = 'block';
    document.getElementById('order-history-title').textContent = 'My Orders';
});
backToOrderListBtn.addEventListener('click', () => {
    orderDetailsView.style.display = 'none';
    orderHistoryList.style.display = 'block';
    document.getElementById('order-history-title').textContent = 'My Orders';
});

// Payment method image update
document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener('change', (event) => {
        const paymentPreviewImg = document.getElementById('payment-preview-img');
        const selectedMethod = event.target.value;
        if (selectedMethod === 'GCash') {
            paymentPreviewImg.src = 'images/gcash.png';
        } else if (selectedMethod === 'Maya') {
            paymentPreviewImg.src = 'images/maya.png';
        } else if (selectedMethod === 'Paypal') {
            paymentPreviewImg.src = 'images/paypal.png';
        }
    });
});

// Search and Filter functionality
document.getElementById('searchBox').addEventListener('input', filterProducts);
document.querySelectorAll('.filters button').forEach(button => {
    button.addEventListener('click', function() {
        // Remove active class from all filter buttons
        document.querySelectorAll('.filters button').forEach(btn => btn.classList.remove('active'));
        // Add active class to the clicked button
        this.classList.add('active');
        filterProducts();
    });
});

// --- Authentication Functions ---
async function handleRegister() {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    authMessage.textContent = ''; // Clear previous messages

    if (!email || !password) {
        showCustomAlert('Please enter both email and password.');
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showCustomAlert('Registration successful! You are now logged in.');
        authModal.classList.remove('show');
    } catch (error) {
        console.error('Error registering:', error.message);
        showCustomAlert(`Registration failed: ${error.message}`);
    }
}

async function handleLogin() {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    authMessage.textContent = ''; // Clear previous messages

    if (!email || !password) {
        showCustomAlert('Please enter both email and password.');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showCustomAlert('Login successful!');
        authModal.classList.remove('show');
    } catch (error) {
        console.error('Error logging in:', error.message);
        showCustomAlert(`Login failed: ${error.message}`);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log('User logged out.');
        // UI will update via onAuthStateChanged listener
    } catch (error) {
        console.error('Error logging out:', error.message);
    }
}

async function handleForgotPassword() {
    const email = authEmailInput.value;
    if (!email) {
        showCustomAlert('Please enter your email to reset password.');
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        showCustomAlert('Password reset email sent! Check your inbox.');
    } catch (error) {
        console.error('Error sending password reset email:', error.message);
        showCustomAlert(`Password reset failed: ${error.message}`);
    }
}

// --- Product Listing Functions ---
let allProducts = []; // Cache for all products
let currentFilters = { category: 'all', searchTerm: '' };

function listenForProducts() {
    // Unsubscribe from previous listener if it exists
    if (unsubscribeProductListener) {
        unsubscribeProductListener();
    }

    // Updated path to match Firebase rules: /artifacts/{appId}/products
    const productsCollectionRef = collection(db, "artifacts", appId, "products");
    unsubscribeProductListener = onSnapshot(productsCollectionRef, (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort products in memory, e.g., by name
        allProducts.sort((a, b) => a.name.localeCompare(b.name));
        filterProducts(); // Re-filter and render products whenever data changes
    }, (error) => {
        console.error("Error fetching products:", error);
    });
}

function renderProducts(productsToRender) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = ''; // Clear existing products

    if (productsToRender.length === 0) {
        productList.innerHTML = '<p class="empty-message">No products match your criteria.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const card = document.createElement('div');
        card.classList.add('card');
        if (product.stock === 0) {
            card.classList.add('out-of-stock');
        }

        // Ensure price and salePrice are numbers before formatting
        const priceValue = parseFloat(product.price);
        const salePriceValue = product.salePrice !== undefined && product.salePrice !== null ? parseFloat(product.salePrice) : null;

        const priceDisplay = product.onSale && salePriceValue !== null && salePriceValue < priceValue
            ? `<span style="text-decoration: line-through; color: #888;">₱${priceValue.toFixed(2)}</span> <span class="price">₱${salePriceValue.toFixed(2)}</span>`
            : `<span class="price">₱${priceValue.toFixed(2)}</span>`;

        const stockInfoClass = product.stock > 0 ? 'in-stock' : 'out-of-stock-text';
        const stockInfoText = product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock';

        card.innerHTML = `
            ${product.isNew ? '<span class="badge new">NEW</span>' : ''}
            ${product.onSale ? '<span class="badge sale" style="left:auto; right:15px;">SALE</span>' : ''}
            <img src="images/${product.image}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/160x160/cccccc/000000?text=No+Image';" />
            <h3>${product.name}</h3>
            <p>${priceDisplay}</p>
            <p class="stock-info ${stockInfoClass}">${stockInfoText}</p>
            <button class="add-to-cart-btn" data-product-id="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        `;
        productList.appendChild(card);
    });

    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            addToCart(productId);
        });
    });
}

function filterProducts() {
    const activeCategoryButton = document.querySelector('.filters button.active');
    const category = activeCategoryButton ? activeCategoryButton.dataset.cat : 'all';
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();

    let filtered = allProducts;

    if (category !== 'all') {
        filtered = filtered.filter(product => product.category === category);
    }

    if (searchTerm) {
        filtered = filtered.filter(product =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm)
        );
    }
    renderProducts(filtered);
}

// --- Cart Functions (Now Firestore-based) ---
let cartItems = []; // In-memory cache of cart items

// New: Listen for real-time updates to the user's cart in Firestore
function listenForCart(uid) {
    if (unsubscribeCartListener) {
        unsubscribeCartListener(); // Unsubscribe from previous listener if exists
    }

    // Path to user's cart document: /artifacts/{appId}/users/{userId}/carts/userCart
    const cartDocRef = doc(db, "artifacts", appId, "users", uid, "carts", "userCart");

    unsubscribeCartListener = onSnapshot(cartDocRef, (docSnap) => {
        if (docSnap.exists()) {
            cartItems = docSnap.data().items || [];
            console.log("Cart fetched from Firestore:", cartItems);
        } else {
            console.log("No cart found for user, initializing empty cart.");
            cartItems = [];
            // Create an empty cart document if it doesn't exist
            setDoc(cartDocRef, { items: [] }).catch(e => console.error("Error creating empty cart doc:", e));
        }
        updateCartDisplay(); // Always update UI when cart data changes
    }, (error) => {
        console.error("Error listening to cart:", error);
    });
}

// Save cart items to Firestore
async function saveCartItemsToFirestore(cart) {
    if (!currentUserId) {
        console.error("Cannot save cart: User not logged in.");
        return;
    }
    try {
        const cartDocRef = doc(db, "artifacts", appId, "users", currentUserId, "carts", "userCart");
        await setDoc(cartDocRef, { items: cart });
        console.log("Cart saved to Firestore.");
        // UI update will happen via the onSnapshot listener for the cart
    } catch (error) {
        console.error("Error saving cart to Firestore:", error);
        showCustomAlert("Failed to save cart. Please try again.");
    }
}

async function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }

    const existingItem = cartItems.find(item => item.id === productId);

    if (existingItem) {
        if (existingItem.quantity + 1 > product.stock) {
            showCustomAlert(`Cannot add more "${product.name}". Only ${product.stock} left in stock.`);
            return;
        }
        existingItem.quantity++;
    } else {
        if (product.stock === 0) {
            showCustomAlert(`"${product.name}" is out of stock and cannot be added to cart.`);
            return;
        }
        cartItems.push({
            id: product.id,
            name: product.name,
            price: product.onSale && product.salePrice !== undefined && product.salePrice !== null && product.salePrice < product.price ? product.salePrice : product.price,
            quantity: 1,
            image: product.image,
            category: product.category
        });
    }
    await saveCartItemsToFirestore(cartItems);
}

async function updateCartItemQuantity(productId, newQuantity) {
    const product = allProducts.find(p => p.id === productId);
    const itemIndex = cartItems.findIndex(item => item.id === productId);

    if (itemIndex > -1 && product) {
        if (newQuantity <= 0) {
            cartItems.splice(itemIndex, 1);
        } else if (newQuantity > product.stock) {
            showCustomAlert(`Cannot set quantity to ${newQuantity} for "${product.name}". Only ${product.stock} left in stock.`);
            cartItems[itemIndex].quantity = product.stock;
        } else {
            cartItems[itemIndex].quantity = newQuantity;
        }
    }
    await saveCartItemsToFirestore(cartItems);
}

async function removeCartItem(productId) {
    cartItems = cartItems.filter(item => item.id !== productId);
    await saveCartItemsToFirestore(cartItems);
}

function updateCartDisplay() {
    cartItemsContainer.innerHTML = ''; // Clear current display
    let subtotal = 0;

    if (cartItems.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        robloxUsernameInput.style.display = 'none'; // Hide Roblox username input if cart is empty
    } else {
        robloxUsernameInput.style.display = 'block'; // Show Roblox username input if cart has items
        cartItems.forEach(item => {
            const cartItemDiv = document.createElement('div');
            cartItemDiv.classList.add('cart-item');
            const itemTotalPrice = item.price * item.quantity;
            subtotal += itemTotalPrice;

            cartItemDiv.innerHTML = `
                <img src="images/${item.image}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/80x80/cccccc/000000?text=No+Image';">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p class="cart-item-price">₱${item.price.toFixed(2)}</p>
                </div>
                <div class="cart-item-quantity-control">
                    <button class="decrease-qty" data-product-id="${item.id}">-</button>
                    <input type="number" value="${item.quantity}" min="1" data-product-id="${item.id}">
                    <button class="increase-qty" data-product-id="${item.id}">+</button>
                </div>
                <button class="cart-item-remove" data-product-id="${item.id}">&times;</button>
            `;
            cartItemsContainer.appendChild(cartItemDiv);
        });
    }

    // Add event listeners for quantity controls and remove buttons
    cartItemsContainer.querySelectorAll('.decrease-qty').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const input = event.target.nextElementSibling;
            let newQuantity = parseInt(input.value) - 1;
            updateCartItemQuantity(productId, newQuantity);
        });
    });

    cartItemsContainer.querySelectorAll('.increase-qty').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            const input = event.target.previousElementSibling;
            let newQuantity = parseInt(input.value) + 1;
            updateCartItemQuantity(productId, newQuantity);
        });
    });

    cartItemsContainer.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('change', (event) => {
            const productId = event.target.dataset.productId;
            let newQuantity = parseInt(event.target.value);
            if (isNaN(newQuantity) || newQuantity < 1) {
                newQuantity = 1; // Default to 1 if invalid input
            }
            updateCartItemQuantity(productId, newQuantity);
        });
    });

    cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            removeCartItem(productId);
        });
    });

    const total = subtotal; // For now, total is same as subtotal, add taxes/shipping later if needed
    cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
    cartTotalSpan.textContent = `₱${total.toFixed(2)}`;
    cartCountBadge.textContent = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    placeOrderBtn.textContent = `Place Order (${cartItems.reduce((sum, item) => sum + item.quantity, 0)} items) ₱${total.toFixed(2)}`;
}

// --- Stock Deduction Function ---
async function deductProductStock(productId, quantityOrdered) {
    try {
        const productRef = doc(db, "artifacts", appId, "products", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
            const currentStock = productSnap.data().stock;
            if (currentStock >= quantityOrdered) {
                const newStock = currentStock - quantityOrdered;
                await updateDoc(productRef, {
                    stock: newStock
                });
                console.log(`Stock for product ${productId} updated to ${newStock}`);
            } else {
                console.warn(`Attempted to deduct stock for product ${productId} but insufficient stock. Current: ${currentStock}, Ordered: ${quantityOrdered}`);
            }
        } else {
            console.error(`Product with ID ${productId} not found for stock deduction.`);
        }
    } catch (error) {
        console.error("Error deducting stock:", error);
    }
}


// --- Place Order Function ---
async function placeOrder() {
    const robloxUsername = robloxUsernameInput.value.trim();
    const selectedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');

    if (!currentUserId) {
        showCustomAlert('You must be logged in to place an order.');
        return;
    }

    if (cartItems.length === 0) {
        showCustomAlert('Your cart is empty. Please add items before placing an order.');
        return;
    }

    if (robloxUsernameInput.style.display !== 'none' && !robloxUsername) {
        showCustomAlert('Please enter your Roblox Username.');
        return;
    }

    if (!selectedPaymentMethod) {
        showCustomAlert('Please select a payment method.');
        return;
    }

    // Pre-order stock validation (uses current `allProducts` cache)
    for (const item of cartItems) {
        const productInCache = allProducts.find(p => p.id === item.id);
        if (!productInCache) {
            showCustomAlert(`Error: Product "${item.name}" not found in our catalog. Please try refreshing.`);
            return;
        }
        if (productInCache.stock === 0) {
            showCustomAlert(`"${item.name}" is out of stock. Please remove it from your cart or reduce quantity.`);
            return;
        }
        if (productInCache.stock < item.quantity) {
            showCustomAlert(`Insufficient stock for "${item.name}". Only ${productInCache.stock} available. Please reduce quantity.`);
            return;
        }
    }

    // Show confirmation modal before placing the order
    showConfirmModal('Are you sure you want to place this order?', async () => {
        try {
            // Prepare order data
            const orderData = {
                userId: currentUserId,
                items: cartItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image,
                    category: item.category,
                })),
                totalPrice: parseFloat(cartTotalSpan.textContent.replace('₱', '')),
                paymentMethod: selectedPaymentMethod.value,
                robloxUsername: robloxUsername,
                status: 'Pending',
                timestamp: serverTimestamp() // Use server timestamp for consistency
            };

            // Add order to user's specific orders collection
            const userOrderDocRef = await addDoc(collection(db, "artifacts", appId, "users", currentUserId, "orders"), orderData);
            const orderId = userOrderDocRef.id; // Get the ID generated by Firestore

            // Add the same order to the allOrders collection for admin view
            await setDoc(doc(db, "artifacts", appId, "allOrders", orderId), {
                ...orderData, // Spread existing order data
                orderId: orderId // Explicitly add orderId to the allOrders document
            });

            // Deduct stock for each item in the order AFTER order is saved
            for (const item of cartItems) {
                await deductProductStock(item.id, item.quantity);
            }

            // Clear the cart in Firestore after successful order
            await saveCartItemsToFirestore([]);
            robloxUsernameInput.value = ''; // Clear username input

            showCustomAlert('Order placed successfully!');
            cartModal.classList.remove('show');
        } catch (error) {
            console.error('Error placing order:', error);
            showCustomAlert('Failed to place order. Please try again.');
        }
    });
}


// --- Order History Functions (User View) ---
function listenForUserOrders(uid) {
    if (unsubscribeUserOrderListener) {
        unsubscribeUserOrderListener();
    }

    const q = query(
        collection(db, "artifacts", appId, "users", uid, "orders")
    );

    unsubscribeUserOrderListener = onSnapshot(q, (snapshot) => {
        let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort orders in memory by timestamp in descending order (newest first)
        orders.sort((a, b) => {
            const dateA = a.timestamp ? a.timestamp.toDate() : new Date(0); // Handle potential missing timestamp
            const dateB = b.timestamp ? b.timestamp.toDate() : new Date(0);
            return dateB.getTime() - dateA.getTime(); // Sort descending
        });

        displayUserOrders(orders); // Re-render orders when data changes
    }, (error) => {
        console.error("Error fetching user orders:", error);
    });
}

function displayUserOrders(orders = []) {
    orderHistoryList.innerHTML = ''; // Clear existing orders

    if (orders.length === 0) {
        orderHistoryList.innerHTML = '<p class="empty-message">No orders found.</p>';
        return;
    }

    orders.forEach(order => {
        const orderItemDiv = document.createElement('div');
        orderItemDiv.classList.add('order-item');
        orderItemDiv.dataset.orderId = order.id;

        const timestampDate = order.timestamp ? new Date(order.timestamp.toDate()) : new Date(); // Convert Firestore Timestamp to Date object
        const formattedDate = timestampDate.toLocaleString(); // Format as local string

        const statusClass = order.status.toLowerCase().replace(/\s/g, '-');

        orderItemDiv.innerHTML = `
            <div class="order-item-info">
                <strong>Order ID: ${order.id.substring(0, 8)}...</strong>
                <span>Date: ${formattedDate}</span>
                <span>Total: ₱${order.totalPrice.toFixed(2)}</span>
                <span class="order-item-status status-${statusClass}">${order.status}</span>
            </div>
            <button class="view-details-btn" data-order-id="${order.id}">View Details</button>
        `;
        orderHistoryList.appendChild(orderItemDiv);
    });

    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const orderId = event.target.dataset.orderId;
            viewOrderDetails(orderId);
        });
    });
}

async function viewOrderDetails(orderId) {
    try {
        const orderDocRef = doc(db, "artifacts", appId, "users", currentUserId, "orders", orderId);
        const orderDocSnap = await getDoc(orderDocRef);

        if (orderDocSnap.exists()) {
            const order = { id: orderDocSnap.id, ...orderDocSnap.data() };
            document.getElementById('detail-order-id').textContent = order.id;
            document.getElementById('detail-order-date').textContent = order.timestamp ? new Date(order.timestamp.toDate()).toLocaleString() : 'N/A';
            document.getElementById('detail-order-status').textContent = order.status;
            document.getElementById('detail-order-price').textContent = `₱${order.totalPrice.toFixed(2)}`;
            document.getElementById('detail-payment-method').textContent = order.paymentMethod;
            document.getElementById('detail-roblox-username').textContent = order.robloxUsername || 'Not provided';

            const detailItemsList = document.getElementById('detail-items-list');
            detailItemsList.innerHTML = '';
            order.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('order-detail-item');
                itemDiv.innerHTML = `
                    <span class="order-detail-item-name">${item.name}</span>
                    <span class="order-detail-item-qty-price">${item.quantity} x ₱${item.price.toFixed(2)}</span>
                `;
                detailItemsList.appendChild(itemDiv);
            });

            orderHistoryList.style.display = 'none';
            orderDetailsView.style.display = 'block';
            document.getElementById('order-history-title').textContent = 'Order Details';

        } else {
            console.log("No such order!");
            showCustomAlert("Order details not found.");
        }
    } catch (error) {
        console.error("Error fetching order details:", error);
        showCustomAlert("Failed to load order details.");
    }
}

// --- Store Settings Functions ---
// This function is for the main page seller status display and general site settings
async function listenForStoreSettings() {
    if (unsubscribeStoreSettingsListener) {
        unsubscribeStoreSettingsListener();
    }

    // Updated path to match Firebase rules: /artifacts/{appId}/settings/global
    const storeSettingsDocRef = doc(db, "artifacts", appId, "settings", "global");

    unsubscribeStoreSettingsListener = onSnapshot(storeSettingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const settings = docSnap.data();
            if (sellerStatusDisplay) {
                if (settings.isSellerOnline) {
                    sellerStatusDisplay.textContent = 'Seller Status: Online';
                    sellerStatusDisplay.classList.remove('status-offline');
                    sellerStatusDisplay.classList.add('status-online');
                } else {
                    sellerStatusDisplay.textContent = 'Seller Status: Offline';
                    sellerStatusDisplay.classList.remove('status-online');
                    sellerStatusDisplay.classList.add('status-offline');
                }
            }
        } else {
            console.log("No store settings found, initializing default.");
            // Initialize default settings if not present
            setDoc(storeSettingsDocRef, { isSellerOnline: false }).catch(e => console.error("Error setting default store settings:", e));
        }
    }, (error) => {
        console.error("Error listening to store settings:", error);
    });
}

// Function to get current store settings value (for admin.js to read)
function getStoreSettingsValue() {
    // This is a synchronous getter for the *current* state known by this script.
    // The actual source of truth is the Firestore listener, which updates the UI.
    // For the admin panel, it's better to read directly from Firestore if precise up-to-the-second data is needed,
    // but this serves as a simple way to pass the *current state* from the main script.
    const currentStatus = sellerStatusDisplay.classList.contains('status-online');
    return currentStatus;
}


// Function to update store settings (called by admin.js)
async function updateStoreSettings(settingsData) {
    if (!currentUserId || currentUserId !== "LigBezoWV9eVo8lglsijoWinKmA2") { // Ensure only admin can update
        showCustomAlert("You are not authorized to update store settings.");
        return;
    }
    try {
        // Updated path to match Firebase rules: /artifacts/{appId}/settings/global
        const storeSettingsDocRef = doc(db, "artifacts", appId, "settings", "global");
        await updateDoc(storeSettingsDocRef, settingsData); // Use updateDoc for existing fields
        console.log("Store settings updated.");
        showCustomAlert("Store settings updated successfully!");
    } catch (error) {
        console.error("Error updating store settings:", error);
        showCustomAlert("Failed to update store settings. Please try again.");
    }
}


// --- Custom Modals (Alert and Confirm) ---
function showCustomAlert(message) {
    const modalId = 'custom-alert-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        // Create modal if it doesn't exist
        modal = document.createElement('div');
        modal.id = modalId;
        modal.classList.add('custom-modal');
        modal.innerHTML = `
            <div class="custom-modal-content">
                <button class="custom-modal-close-btn">&times;</button>
                <p id="custom-alert-message"></p>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-ok-btn">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.custom-modal-ok-btn').addEventListener('click', () => modal.classList.remove('show'));
        modal.querySelector('.custom-modal-close-btn').addEventListener('click', () => modal.classList.remove('show'));
    }
    modal.querySelector('#custom-alert-message').textContent = message;
    modal.classList.add('show');
}

function showConfirmModal(message, onConfirmCallback) {
    const modalId = 'custom-confirm-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        // Create modal if it doesn't exist
        modal = document.createElement('div');
        modal.id = modalId;
        modal.classList.add('custom-modal');
        modal.innerHTML = `
            <div class="custom-modal-content">
                <button class="custom-modal-close-btn">&times;</button>
                <p id="custom-confirm-message"></p>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-cancel-btn">Cancel</button>
                    <button class="custom-modal-confirm-btn">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const confirmBtn = modal.querySelector('.custom-modal-confirm-btn');
    const cancelBtn = modal.querySelector('.custom-modal-cancel-btn');
    const closeBtn = modal.querySelector('.custom-modal-close-btn');

    // Clear previous listeners to prevent multiple calls
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    closeBtn.onclick = null;

    confirmBtn.onclick = () => {
        modal.classList.remove('show');
        onConfirmCallback();
    };
    cancelBtn.onclick = () => modal.classList.remove('show');
    closeBtn.onclick = () => modal.classList.remove('show');

    modal.querySelector('#custom-confirm-message').textContent = message;
    modal.classList.add('show');
}
