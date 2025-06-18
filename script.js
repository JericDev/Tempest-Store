        // Import the functions you need from the SDKs you need
        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
        // Import writeBatch for atomic updates and necessary Firestore functions
        import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
        // Import Firebase Storage functions
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

        // Your web app's Firebase configuration
        // IMPORTANT: Ensure this configuration matches your Firebase project's config.
        const firebaseConfig = {
          apiKey: "AIzaSyA4xfUevmevaMDxK2_gLgvZUoqm0gmCn_k",
          authDomain: "store-7b9bd.firebaseapp.com",
          projectId: "store-7b9bd",
          storageBucket: "store-7b9bd.firebaseapp.com", // Ensure this matches your Storage Bucket URL
          messagingSenderId: "1015427798898",
          appId: "1:1015427798898:web:a15c71636506fac128afeb",
          measurementId: "G-NR4JS3FLWG"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app); // Initialize Firestore
        const storage = getStorage(app); // Initialize Firebase Storage

        let currentUserId = null; // To store the current authenticated user's ID
        let isAdmin = false; // Flag to check if the current user is an admin
        const ADMIN_UID = "LigBezoWV9eVo8lglsijoWinKmA2"; 

        let cart = []; // Global cart array
        let allProducts = []; // Global array to store all products from Firestore
        
        // Global variables to store unsubscribe functions for real-time listeners
        let unsubscribeProducts = null;
        let unsubscribeSellerStatus = null; 
        let unsubscribeUserOrders = null; // Unsubscribe for user's own orders
        
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
        const myOrdersButton = document.getElementById("my-orders-button"); // My Orders button
        const adminPanelButton = document.getElementById("admin-panel-button"); 
        const authMessage = document.getElementById("auth-message");
        const userDisplay = document.getElementById("user-display");
        const authModal = document.getElementById("auth-modal"); 
        const closeAuthModalBtn = document.getElementById("close-auth-modal"); 
        const forgotPasswordButton = document.getElementById("forgot-password-button");

        // DOM element for Seller Status
        const sellerStatusDisplay = document.getElementById("seller-status-display");

        // DOM elements for Order History Modal
        const orderHistoryModal = document.getElementById("order-history-modal");
        const closeOrderHistoryModalBtn = document.getElementById("close-order-history-modal");
        const orderHistoryList = document.getElementById("order-history-list");
        const orderDetailsView = document.getElementById("order-details-view");
        const detailOrderId = document.getElementById("detail-order-id");
        const detailOrderDate = document.getElementById("detail-order-date");
        const detailOrderStatus = document.getElementById("detail-order-status");
        const detailOrderPrice = document.getElementById("detail-order-price");
        const detailPaymentMethod = document.getElementById("detail-payment-method");
        const detailRobloxUsername = document.getElementById("detail-roblox-username");
        const detailItemsList = document.getElementById("detail-items-list");
        const backToOrderListBtn = document.getElementById("back-to-order-list");


        // --- DOM elements for Cart/Checkout ---
        const cartIconBtn = document.getElementById("cart-icon-btn");
        const cartCountBadge = document.getElementById("cart-count");
        const cartModal = document.getElementById("cart-modal");
        const closeCartModalBtn = document.getElementById("close-cart-modal");
        const cartItemsContainer = document.getElementById("cart-items-container");
        const cartSubtotalSpan = document.getElementById("cart-subtotal");
        const cartTotalSpan = document = document.getElementById("cart-total"); 
        const placeOrderBtn = document.getElementById("place-order-btn");
        const robloxUsernameInput = document.getElementById("roblox-username-input");
        const paymentMethodRadios = document.querySelectorAll('input[name="payment-method"]'); // Get all payment radio buttons
        const paymentQrImage = document.getElementById("payment-qr-image");
        const paymentQrMessage = document.getElementById("payment-qr-message");

        // --- Payment QR Code Image URLs (User needs to update these with their actual GitHub URLs) ---
        const paymentImageUrls = {
            'GCash': 'https://placehold.co/300x300/4CAF50/FFFFFF?text=GCash%20QR%0ACode%0A(Update%20in%20script.js)',
            'Maya': 'https://placehold.co/300x300/673AB7/FFFFFF?text=Maya%20QR%0ACode%0A(Update%20in%20script.js)',
            'PayPal': 'https://placehold.co/300x300/0070BA/FFFFFF?text=PayPal%20QR%0ACode%0A(Update%20in%20script.js)'
        };
        // --- End of Payment QR Code Image URLs ---


        // --- Authentication Functions ---
        registerButton.addEventListener("click", () => {
            const email = authEmailInput.value;
            const password = authPasswordInput.value;
            if (!email || !password) { authMessage.textContent = "Please enter email and password."; return; }
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    authMessage.textContent = `Registered and logged in as: ${userCredential.user.email}`;
                    authMessage.style.color = 'green'; 
                    console.log("[Auth] User registered:", userCredential.user.email);
                    authModal.classList.remove('show'); 
                })
                .catch((error) => { 
                    if (error.code === 'auth/email-already-in-use') {
                        authMessage.textContent = "Registration failed: This email is already in use. Try logging in.";
                    } else {
                        authMessage.textContent = `Registration failed: ${error.message}`; 
                    }
                    authMessage.style.color = 'red'; 
                    console.error("[Auth] Registration error:", error); 
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
                    console.log("[Auth] User logged in:", userCredential.user.email);
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
                    console.error("[Auth] Login error:", error); 
                });
        });

        logoutButton.addEventListener("click", () => {
            signOut(auth)
                .then(() => {
                    authMessage.textContent = "Logged out successfully.";
                    authMessage.style.color = 'green'; 
                    console.log("[Auth] User logged out.");
                })
                .catch((error) => { 
                    authMessage.textContent = `Logout failed: ${error.message}`; 
                    authMessage.style.color = 'red'; 
                    console.error("[Auth] Logout error:", error); 
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
                    console.error("[Auth] Password reset error:", error);
                });
        });


        // --- Authentication State Observer (Crucial for loading user data) ---
        onAuthStateChanged(auth, async (user) => {
            console.log("--- Auth State Changed ---");
            // Clean up admin panel if currently active
            if (adminCleanupFunction) {
                console.log("[Admin] Calling admin cleanup function.");
                adminCleanupFunction();
                adminCleanupFunction = null;
            }
            // Clean up user orders listener
            if (unsubscribeUserOrders) {
                console.log("[Orders] Unsubscribing from user orders.");
                unsubscribeUserOrders();
                unsubscribeUserOrders = null;
            }

            if (user) {
                currentUserId = user.uid; // Set current user ID
                isAdmin = (currentUserId === ADMIN_UID); // Check if current user is admin
                console.log(`[Auth] User logged in: ${user.email} (UID: ${currentUserId})`);
                console.log(`[Auth] Is user admin? ${isAdmin}`);

                userDisplay.textContent = `Welcome, ${user.email}`;
                loginRegisterButton.style.display = "none"; 
                logoutButton.style.display = "inline-block";
                myOrdersButton.style.display = "inline-block"; // Show My Orders button

                if (isAdmin) {
                    console.log("[Admin] User is admin. Setting admin panel button to 'inline-block'.");
                    adminPanelButton.style.display = "inline-block"; // Show Admin Panel button
                    // NEW: Log the computed style of the button
                    if (adminPanelButton) {
                        console.log("[Admin] Admin Panel Button computed display style:", window.getComputedStyle(adminPanelButton).display);
                    } else {
                        console.warn("[Admin] Admin Panel Button element not found in DOM.");
                    }

                    // Dynamically import and initialize admin module
                    if (!initAdminPanelModule) {
                        console.log("[Admin] admin.js module not yet loaded. Attempting dynamic import...");
                        try {
                            // Ensure the path is correct relative to script.js
                            const adminModule = await import('./admin.js'); 
                            initAdminPanelModule = adminModule.initAdminPanel;
                            adminCleanupFunction = adminModule.cleanupAdminPanel; // Get cleanup function
                            console.log("[Admin] admin.js loaded successfully. initAdminPanelModule set.");
                        } catch (error) {
                            console.error("[Admin] Error loading admin.js:", error);
                            // Hide admin button if load fails
                            adminPanelButton.style.display = "none"; 
                            console.log("[Admin] Admin panel button hidden due to admin.js load error.");
                        }
                    }
                    if (initAdminPanelModule) {
                        console.log("[Admin] Calling initAdminPanelModule.");
                        // Pass Firestore and Auth instances, plus user info to admin module
                        initAdminPanelModule(db, auth, storage, currentUserId, isAdmin); // Pass storage instance
                        console.log("[Admin] initAdminPanelModule call attempted.");
                    } else {
                        console.log("[Admin] initAdminPanelModule is null after attempted load. Admin panel won't function.");
                    }
                } else {
                    console.log(`[Admin] User is NOT admin (currentUserId: ${currentUserId}). Hiding admin panel button.`);
                    adminPanelButton.style.display = "none";
                }
                
                robloxUsernameInput.style.display = "block"; 
                
                console.log("[Cart] Loading cart from Firestore...");
                await loadCartFromFirestore(currentUserId); 
                console.log("[Cart] Syncing cart on login...");
                await syncCartOnLogin(currentUserId); 
                
                console.log("[Orders] Setting up user order history listener...");
                setupUserOrderHistoryListener(currentUserId); // Load orders for authenticated user

            } else {
                console.log("[Auth] User is logged out. Resetting UI elements.");
                currentUserId = null; 
                isAdmin = false; 

                userDisplay.textContent = "";
                loginRegisterButton.style.display = "inline-block"; 
                logoutButton.style.display = "none";
                myOrdersButton.style.display = "none"; // Hide My Orders button
                adminPanelButton.style.display = "none"; 
                
                robloxUsernameInput.style.display = "none"; 

                console.log("[Cart] Loading cart from Local Storage (user logged out)...");
                cart = loadCartFromLocalStorage(); 
                // userOrders = []; // User orders handled by listener cleanup now
                // allProducts = []; // Products are always rendered via setupProductsListener
                // allOrders = []; // Admin orders handled by admin cleanup now
            }
            authEmailInput.value = "";
            authPasswordInput.value = "";
            authMessage.textContent = "";
            authMessage.style.color = 'red'; 
            console.log("[UI] Rendering cart...");
            renderCart(); 
            // Products are always rendered via the setupProductsListener called globally.
        });

        // --- Firestore Collection Paths ---
        const APP_ID = 'tempest-store-app'; 
        const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`; 
        const USER_CARTS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/carts`;
        const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
        const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`; 
        const SETTINGS_COLLECTION_PATH = `artifacts/${APP_ID}/settings`; // New settings collection


        // --- Seller Status Management ---
        // Sets up a real-time listener for the global seller status
        function setupSellerStatusListener() {
            if (unsubscribeSellerStatus) {
                unsubscribeSellerStatus(); // Unsubscribe from previous listener if it exists
            }
            const sellerStatusDocRef = doc(db, SETTINGS_COLLECTION_PATH, 'sellerStatus');
            unsubscribeSellerStatus = onSnapshot(sellerStatusDocRef, (docSnap) => {
                console.log("[Seller Status] Listener triggered.");
                if (docSnap.exists()) {
                    const statusData = docSnap.data();
                    const isOnline = statusData.isOnline;
                    sellerStatusDisplay.textContent = isOnline ? 'Online' : 'Offline';
                    sellerStatusDisplay.classList.toggle('online', isOnline);
                    sellerStatusDisplay.classList.toggle('offline', !isOnline);
                    console.log(`[Seller Status] Status: ${isOnline ? 'Online' : 'Offline'}`);
                } else {
                    sellerStatusDisplay.textContent = 'Offline';
                    sellerStatusDisplay.classList.remove('online');
                    sellerStatusDisplay.classList.add('offline');
                    console.log("[Seller Status] Document does not exist. Defaulting to Offline. Attempting to create default.");
                    // Create the default status document if it's missing (should only happen once)
                    setDoc(sellerStatusDocRef, { isOnline: false }, { merge: true }).catch(e => console.error("[Seller Status] Error creating default seller status:", e));
                }
            }, (error) => {
                console.error("[Seller Status] Error listening to seller status:", error);
            });
        }
        // Call this listener immediately when script loads to display initial status
        setupSellerStatusListener();


        // --- Product Display (Accessible to all) ---
        function setupProductsListener() {
            if (unsubscribeProducts) {
                unsubscribeProducts();
            }
            const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
            unsubscribeProducts = onSnapshot(productsColRef, (snapshot) => { 
                console.log("[Products] Products listener triggered. Fetching products...");
                const fetchedProducts = [];
                snapshot.forEach(doc => {
                    fetchedProducts.push({ id: doc.id, ...doc.data() });
                });
                allProducts = fetchedProducts; 
                console.log(`[Products] Fetched ${allProducts.length} products.`);
                renderProducts(allProducts); 
                // Re-render cart on product changes to update prices
                renderCart();
            }, (error) => {
                console.error("[Products] Error listening to products:", error);
            });
        }

        // Call setupProductsListener once when the script loads to always show products
        setupProductsListener();

        // --- Cart Persistence (Customer-side) ---
        async function saveCartToFirestore(userId, cartData) {
            try {
                const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
                await setDoc(userCartRef, { items: JSON.stringify(cartData) }); 
                console.log("[Cart] Cart saved to Firestore for user:", userId);
            } catch (e) {
                console.error("[Cart] Error saving cart to Firestore:", e);
            }
        }

        async function loadCartFromFirestore(userId) {
            try {
                const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
                const docSnap = await getDoc(userCartRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    cart = JSON.parse(data.items || '[]'); 
                    console.log("[Cart] Cart loaded from Firestore for user:", userId, cart);
                } else {
                    cart = []; 
                    console.log("[Cart] No cart found in Firestore for user:", userId);
                }
            } catch (e) {
                console.error("[Cart] Error loading cart from Firestore:", e);
                cart = []; 
            }
        }

        function saveCartToLocalStorage(cartData) {
            localStorage.setItem('tempestStoreCart', JSON.stringify(cartData));
            console.log("[Cart] Cart saved to Local Storage.");
        }

        function loadCartFromLocalStorage() {
            const storedCart = localStorage.getItem('tempestStoreCart');
            const loadedCart = storedCart ? JSON.parse(storedCart) : [];
            console.log("[Cart] Cart loaded from Local Storage:", loadedCart);
            return loadedCart;
        }

        async function syncCartOnLogin(userId) {
            const localCart = loadCartFromLocalStorage();
            if (localCart.length > 0) {
                console.log("[Cart] Local cart found. Syncing with Firestore...");
                const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
                const docSnap = await getDoc(userCartRef);
                let firestoreCart = [];
                if (docSnap.exists()) {
                    firestoreCart = JSON.parse(docSnap.data().items || '[]');
                    console.log("[Cart] Existing Firestore cart found:", firestoreCart);
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
                            // Fallback if product not found (e.g., deleted by admin)
                            console.warn(`[Cart] Product ${localItem.name} (ID: ${localItem.id}) not found in allProducts during sync. Adding with existing price.`);
                            firestoreCart.push(localItem);
                        }
                    }
                });
                cart = firestoreCart; 
                await saveCartToFirestore(userId, cart); 
                localStorage.removeItem('tempestStoreCart'); 
                console.log("[Cart] Local cart cleared after sync.");
                renderCart(); 
            } else {
                console.log("[Cart] No local cart found to sync.");
            }
        }

        // --- Cart Management Functions ---
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
            console.log("[Cart] Added to cart:", product.name, "Current cart:", cart);
        }

        function removeFromCart(productId) {
            cart = cart.filter(item => item.id !== productId);
            saveCart(); 
            renderCart(); 
            console.log("[Cart] Removed from cart:", productId, "Current cart:", cart);
        }

        function updateCartQuantity(productId, newQuantity) {
            const item = cart.find(item => item.id === productId);
            if (item) {
                item.quantity = Math.max(1, newQuantity); 
                saveCart(); 
                renderCart(); 
                console.log("[Cart] Updated quantity for", productId, "to", newQuantity);
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
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            cartCountBadge.textContent = totalItems;
            cartCountBadge.style.display = totalItems > 0 ? 'inline-block' : 'none'; 

            const { total } = calculateCartTotals();
            placeOrderBtn.textContent = `Place Order (${totalItems} item${totalItems !== 1 ? 's' : ''}) ₱${total.toFixed(2)}`;
            
            // Check if cart is empty OR if user is logged in and Roblox username is empty
            const isRobloxUsernameMissing = currentUserId && robloxUsernameInput.value.trim() === '';
            placeOrderBtn.disabled = totalItems === 0 || isRobloxUsernameMissing;
            console.log(`[Cart UI] Cart badge updated: ${totalItems} items, Place Order button state: ${placeOrderBtn.disabled ? 'disabled' : 'enabled'}`);
        }

        function renderCart() {
            cartItemsContainer.innerHTML = ''; 

            if (cart.length === 0) {
                cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
            } else {
                cart.forEach(item => {
                    // Find the latest product details from allProducts
                    const productDetails = allProducts.find(p => p.id === item.id);
                    let priceToDisplay;
                    if (productDetails) {
                        priceToDisplay = productDetails.sale && productDetails.salePrice ? productDetails.salePrice : productDetails.price;
                        // Update item's effectivePrice in cart to match latest
                        item.effectivePrice = priceToDisplay; 
                    } else {
                        // Fallback if product is no longer found (e.g., deleted by admin)
                        console.warn(`[Cart UI] Product ${item.name} (ID: ${item.id}) not found in allProducts during render. Displaying existing effectivePrice.`);
                        priceToDisplay = item.effectivePrice || item.price;
                    }

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
            displayPaymentQrCode(); // Ensure QR code is updated when cart renders
            console.log("[Cart UI] Cart items rendered.");
        }

        function calculateCartTotals() {
            let subtotal = 0;
            let totalItemsInCart = 0;
            cart.forEach(item => {
                // IMPORTANT: Use the effectivePrice from the cart item, which is updated in renderCart()
                // or fall back to item.price if effectivePrice isn't set (shouldn't happen with updated logic)
                const priceValue = parseFloat((item.effectivePrice || item.price).replace('₱', '')); 
                subtotal += priceValue * item.quantity;
                totalItemsInCart += item.quantity;
            });

            const total = subtotal; 

            cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
            cartTotalSpan.textContent = `₱${total.toFixed(2)}`;
            console.log(`[Cart Totals] Subtotal: ₱${subtotal.toFixed(2)}, Total: ₱${total.toFixed(2)}`);

            return { subtotal, total, totalItemsInCart }; 
        }

        // --- Cart Modal Event Listeners ---
        cartIconBtn.addEventListener('click', () => {
            cartModal.classList.add('show');
            renderCart();
            robloxUsernameInput.style.display = currentUserId ? 'block' : 'none'; 
            updateCartCountBadge();
            // Automatically select and display QR for the initially checked payment method
            const checkedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');
            if (checkedPaymentMethod) {
                displayPaymentQrCode(checkedPaymentMethod.value);
            } else {
                // If no method is checked, clear QR and show message
                paymentQrImage.style.display = 'none';
                paymentQrImage.src = '';
                paymentQrMessage.style.display = 'block';
            }
            console.log("[Cart Modal] Opened cart modal.");
        });

        closeCartModalBtn.addEventListener('click', () => {
            cartModal.classList.remove('show');
            console.log("[Cart Modal] Closed cart modal.");
        });

        cartModal.addEventListener('click', (event) => {
            if (event.target === cartModal) {
                cartModal.classList.remove('show');
                console.log("[Cart Modal] Closed cart modal by clicking outside.");
            }
        });

        robloxUsernameInput.addEventListener('input', updateCartCountBadge);

        // --- Payment Method Image Display Logic ---
        paymentMethodRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                displayPaymentQrCode(event.target.value);
                console.log("[Payment] Payment method changed to:", event.target.value);
            });
        });

        function displayPaymentQrCode(method) {
            const imageUrl = paymentImageUrls[method];
            if (imageUrl) {
                paymentQrImage.src = imageUrl;
                paymentQrImage.style.display = 'block';
                paymentQrMessage.style.display = 'none';
                console.log("[Payment] Displaying QR for:", method);
            } else {
                paymentQrImage.style.display = 'none';
                paymentQrImage.src = '';
                paymentQrMessage.style.display = 'block';
                paymentQrMessage.textContent = 'Image not available for this payment method.';
                console.warn("[Payment] No QR image URL found for:", method);
            }
        }


        // Handles the process of placing an order.
        placeOrderBtn.addEventListener('click', async () => {
            console.log("[Order] Place order button clicked.");
            if (cart.length === 0) {
                alert("Your cart is empty. Please add items before placing an order.");
                console.log("[Order] Cart is empty. Order not placed.");
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
                    console.log("[Order] User not logged in. Prompting for login/registration.");
                    return; 
                }
                
                if (robloxUsername === '') {
                    alert("Please enter your Roblox Username to proceed with the order.");
                    placeOrderBtn.disabled = false; 
                    console.log("[Order] Roblox username is empty. Order not placed.");
                    return; 
                }

                // Recalculate totals right before placing order with latest effective prices
                const { subtotal, total } = calculateCartTotals(); 
                const orderDetails = {
                    userId: currentUserId,
                    // Deep copy cart items to ensure order details are immutable if cart changes later
                    // Items in cart will have updated effectivePrice from renderCart()
                    items: JSON.parse(JSON.stringify(cart)), 
                    subtotal: subtotal,
                    total: total,
                    orderDate: new Date().toISOString(), 
                    status: 'Pending', 
                    paymentMethod: document.querySelector('input[name="payment-method"]:checked').value, 
                    robloxUsername: robloxUsername 
                };

                console.log("[Order] Attempting to place order with details:", orderDetails);

                const batch = writeBatch(db); // Start a new batch for atomic updates

                // 1. Add order to user's personal collection
                const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUserId));
                const userOrderDocRef = doc(userOrdersColRef); // Create a new doc ref with auto-generated ID
                batch.set(userOrderDocRef, orderDetails);
                console.log("[Order] Batch: Adding order to user's collection.");

                // 2. Add order to central 'allOrders' collection
                const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
                batch.set(doc(allOrdersColRef, userOrderDocRef.id), orderDetails); // Use same ID
                console.log("[Order] Batch: Adding order to allOrders collection.");

                // 3. Deduct stock for each item in the cart
                for (const item of cart) {
                    const productRef = doc(db, PRODUCTS_COLLECTION_PATH, item.id);
                    // Fetch current product to safely deduct stock, this should be already available in allProducts
                    const currentProduct = allProducts.find(p => p.id === item.id);
                    if (currentProduct && currentProduct.stock >= item.quantity) {
                        batch.update(productRef, {
                            stock: currentProduct.stock - item.quantity
                        });
                        console.log(`[Order] Batch: Deducting ${item.quantity} from stock for product ${item.name}.`);
                    } else {
                        // This case should ideally be prevented by UI checks
                        console.warn(`[Order] Product ${item.name} (ID: ${item.id}) is out of stock or insufficient quantity for order. Stock: ${currentProduct ? currentProduct.stock : 'N/A'}`);
                        alert(`Not enough stock for ${item.name}. Please adjust your cart.`);
                        placeOrderBtn.disabled = false;
                        return; // Stop the order process
                    }
                }

                await batch.commit(); // Commit all batch operations atomically
                console.log("[Order] Batch commit successful!");

                alert("Successfully Placed Order!"); 
                console.log("Order saved and stock deducted in Firestore!");
                
                cart = [];
                saveCart();
                renderCart();
                cartModal.classList.remove('show');
                robloxUsernameInput.value = ''; 

            } catch (e) {
                console.error("[Order] Error placing order to Firestore or deducting stock:", e);
                alert("There was an error placing your order. Please try again.");
            } finally {
                placeOrderBtn.disabled = false; 
                console.log("[Order] Place Order button enabled.");
            }
        });


        // --- Product Display Functions (Main Store Page) ---
        function renderProducts(items) {
            const list = document.getElementById("product-list");
            list.innerHTML = ""; 
            console.log("[Product UI] Rendering products. Total items to render:", items.length);

            if (items.length === 0) {
                 list.innerHTML = '<p class="empty-message" style="width: 100%;">No products available. Please add some from the Admin Panel!</p>';
                 console.log("[Product UI] No products to render. Displaying empty message.");
                 return;
            }

            items.forEach(product => {
                const card = document.createElement("div");
                card.className = "card";
                const isOutOfStock = !product.stock || product.stock <= 0;
                if (isOutOfStock) card.classList.add("out-of-stock"); 

                const displayPrice = product.sale && product.salePrice ? 
                                     `<span style="text-decoration: line-through; color: #888; font-size: 0.9em;">₱${parseFloat(product.price.replace('₱', '')).toFixed(2)}</span> ₱${parseFloat(product.salePrice.replace('₱', '')).toFixed(2)}` : 
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
                    const productToAdd = allProducts.find(p => p.id === productId); 
                    if (productToAdd) {
                        addToCart(productToAdd); 
                    }
                });
            });
            console.log("[Product UI] Products rendered successfully.");
        }

        // Global functions for filters, called directly from HTML onclick/oninput
        // IMPORTANT: These functions are now explicitly attached to the window object.
        window.setFilter = function(category) {
            window.currentCategory = category; 
            document.querySelectorAll(".filters button").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.cat === category);
            });
            window.applyFilters(); 
            console.log("[Filter] Category filter set to:", category);
        }

        window.applyFilters = function() {
            const query = document.getElementById("searchBox").value.toLowerCase();
            const filtered = allProducts.filter(product => { 
                const matchesCategory = window.currentCategory === "all" || product.category === window.currentCategory;
                const matchesSearch = product.name.toLowerCase().includes(query);
                return matchesCategory && matchesSearch;
            });
            renderProducts(filtered); 
            console.log(`[Filter] Applied filters. Search query: "${query}", Category: "${window.currentCategory}". Found ${filtered.length} products.`);
        }
        window.currentCategory = "all"; // Initialize global currentCategory

        // --- Order History Functions (Customer Side) ---
        myOrdersButton.addEventListener('click', () => {
            console.log("[My Orders] My Orders button clicked.");
            if (!currentUserId) {
                alert("Please log in to view your orders.");
                console.log("[My Orders] User not logged in. Cannot view orders.");
                return;
            }
            orderHistoryModal.classList.add('show');
            // Listener is already setup in onAuthStateChanged, just need to ensure render
            // loadOrdersFromFirestore(currentUserId); // This is now handled by the onSnapshot listener
            console.log("[My Orders] Showing order history modal.");
        });

        closeOrderHistoryModalBtn.addEventListener('click', () => {
            orderHistoryModal.classList.remove('show');
            console.log("[My Orders] Closed order history modal.");
        });

        orderHistoryModal.addEventListener('click', (event) => {
            if (event.target === orderHistoryModal) {
                orderHistoryModal.classList.remove('show');
                console.log("[My Orders] Closed order history modal by clicking outside.");
            }
        });

        backToOrderListBtn.addEventListener('click', () => {
            orderHistoryList.style.display = 'block';
            orderDetailsView.style.display = 'none';
            console.log("[My Orders] Back to order list view.");
        });

        // Sets up a real-time listener for a specific user's order history in Firestore.
        // This function will be called once onAuthStateChanged.
        function setupUserOrderHistoryListener(userId) {
            if (unsubscribeUserOrders) {
                unsubscribeUserOrders(); // Unsubscribe from previous listener if it exists
                console.log("[Orders] Existing user orders listener unsubscribed.");
            }
            const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(userId));
            const q = query(userOrdersColRef, orderBy("orderDate", "desc")); // Order by most recent

            unsubscribeUserOrders = onSnapshot(q, (snapshot) => {
                console.log("[Orders] User orders listener triggered. Fetching user orders...");
                const fetchedOrders = [];
                snapshot.forEach(docSnap => {
                    fetchedOrders.push({ id: docSnap.id, ...docSnap.data() });
                });
                // userOrders is not a global variable in this script, it was local to loadOrdersFromFirestore.
                // We will directly render here or assign to a global if it's used elsewhere for data storage.
                // For now, let's keep it simple and just render.
                renderUserOrdersList(fetchedOrders); // Pass fetched orders to render function
                console.log(`[Orders] Fetched ${fetchedOrders.length} user orders.`);
            }, (error) => {
                console.error("[Orders] Error listening to user order history:", error);
                orderHistoryList.innerHTML = '<p class="empty-message">Error loading your orders.</p>';
            });
        }

        function renderUserOrdersList(ordersToRender) {
            orderHistoryList.innerHTML = ''; // Clear existing list
            if (ordersToRender.length === 0) {
                orderHistoryList.innerHTML = '<p class="empty-message">You have no past orders.</p>';
                console.log("[My Orders UI] No user orders to render. Displaying empty message.");
                return;
            }

            ordersToRender.forEach(order => {
                const orderDate = new Date(order.orderDate).toLocaleDateString();
                const orderDiv = document.createElement('div');
                orderDiv.className = 'order-summary-item';
                orderDiv.innerHTML = `
                            <p><strong>Order ID:</strong> ${order.id.substring(0, 8)}...</p>
                            <p><strong>Date:</strong> ${orderDate}</p>
                            <p><strong>Total:</strong> ₱${order.total.toFixed(2)}</p>
                            <p><strong>Status:</strong> <span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}}">${order.status}</span></p>
                            <button class="view-order-details" data-order-id="${order.id}">View Details</button>
                        `;
                orderHistoryList.appendChild(orderDiv);
            });

            // Add event listeners for "View Details" buttons
            orderHistoryList.querySelectorAll('.view-order-details').forEach(button => {
                button.addEventListener('click', (e) => {
                    const orderId = e.target.dataset.orderId;
                    // Find the order from the currently rendered list
                    const selectedOrder = ordersToRender.find(order => order.id === orderId);
                    if (selectedOrder) {
                        showOrderDetails(selectedOrder);
                    }
                });
            });
            console.log("[My Orders UI] User orders list rendered.");
        }


        async function showOrderDetails(order) { // This function now takes the order object directly
            console.log("[My Orders] Showing details for order ID:", order.id);
            orderHistoryList.style.display = 'none';
            orderDetailsView.style.display = 'block';

            detailOrderId.textContent = order.id;
            detailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
            detailOrderStatus.textContent = order.status;
            detailOrderStatus.className = `order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`; // Apply status class
            detailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
            detailPaymentMethod.textContent = order.paymentMethod;
            detailRobloxUsername.textContent = order.robloxUsername || 'N/A';

            detailItemsList.innerHTML = '';
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'order-detail-item';
                    itemDiv.innerHTML = `
                                <span>${item.name}</span>
                                <span>Qty: ${item.quantity}</span>
                                <span>${item.effectivePrice || item.price}</span>
                            `;
                    detailItemsList.appendChild(itemDiv);
                });
            } else {
                detailItemsList.innerHTML = '<p>No items found for this order.</p>';
            }
            console.log("[My Orders] Order details populated for order ID:", order.id);
        }


        // Event listener for when the DOM content is fully loaded.
        window.addEventListener("DOMContentLoaded", () => {
            updateCartCountBadge(); 
            // Trigger initial display of payment QR code for the default checked radio button
            const checkedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');
            if (checkedPaymentMethod) {
                displayPaymentQrCode(checkedPaymentMethod.value);
            }
            console.log("[Init] DOM Content Loaded. Initial UI setup complete.");
        });
