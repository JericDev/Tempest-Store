        // Import the functions you need from the SDKs you need
        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

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
        let allOrders = []; // Global array to store all orders for admin view


        // Global variables to store unsubscribe functions for real-time listeners
        let unsubscribeUserOrders = null;
        let unsubscribeProducts = null;
        let unsubscribeAllOrders = null;


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
        const cartTotalSpan = document.getElementById("cart-total"); // Removed cartShippingSpan
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

        // --- DOM elements for Admin Panel ---
        const adminPanelModal = document.getElementById("admin-panel-modal");
        const closeAdminPanelModalBtn = document.getElementById("close-admin-panel-modal");
        const adminTabButtons = document.querySelectorAll(".admin-tab-btn");
        const adminProductManagement = document.getElementById("admin-product-management");
        const adminOrderManagement = document.getElementById("admin-order-management");

        // Product Form elements
        const productFormTitle = document.getElementById("product-form-title");
        const productIdInput = document.getElementById("product-id-input");
        const productNameInput = document.getElementById("product-name");
        const productCategorySelect = document.getElementById("product-category");
        const productPriceInput = document.getElementById("product-price");
        const productSalePriceInput = document.getElementById("product-sale-price"); 
        const productStockInput = document.getElementById("product-stock");
        const productImageInput = document.getElementById("product-image"); // Changed to text input for filename
        const productNewCheckbox = document.getElementById("product-new");
        const productSaleCheckbox = document.getElementById("product-sale");
        const saveProductBtn = document.getElementById("save-product-btn");
        const cancelEditProductBtn = document.getElementById("cancel-edit-product");
        const adminProductsList = document.getElementById("admin-products-list");

        // Order Management elements
        const adminOrdersList = document.getElementById("admin-orders-list");
        const adminOrderDetailsView = document.getElementById("admin-order-details-view");
        const adminDetailOrderId = document.getElementById("admin-detail-order-id");
        const adminDetailUserId = document.getElementById("admin-detail-user-id");
        const adminDetailRobloxUsername = document.getElementById("admin-detail-roblox-username");
        const adminDetailOrderDate = document.getElementById("admin-detail-order-date");
        const adminDetailOrderPrice = document.getElementById("admin-detail-order-price");
        const adminDetailPaymentMethod = document.getElementById("admin-detail-payment-method");
        const adminDetailOrderStatus = document.getElementById("admin-detail-order-status");
        const adminDetailItemsList = document.getElementById("admin-detail-items-list");
        const orderStatusSelect = document.getElementById("order-status-select");
        const updateOrderStatusBtn = document.getElementById("update-order-status-btn");
        const adminBackToOrderListBtn = document.getElementById("admin-back-to-order-list");
        let currentEditingOrderId = null;


        // --- Authentication Functions ---
        registerButton.addEventListener("click", () => {
            const email = authEmailInput.value;
            const password = authPasswordInput.value;
            if (!email || !password) { authMessage.textContent = "Please enter email and password."; return; }
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    authMessage.textContent = `Registered and logged in as: ${userCredential.user.email}`;
                    authMessage.style.color = 'green'; // Success message color
                    console.log("User registered:", userCredential.user.email);
                    authModal.classList.remove('show'); // Close modal on success
                })
                .catch((error) => { 
                    if (error.code === 'auth/email-already-in-use') {
                        authMessage.textContent = "Registration failed: This email is already in use. Try logging in.";
                    } else {
                        authMessage.textContent = `Registration failed: ${error.message}`; 
                    }
                    authMessage.style.color = 'red'; // Error message color
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
                    authMessage.style.color = 'green'; // Success message color
                    console.log("User logged in:", userCredential.user.email);
                    authModal.classList.remove('show'); // Close modal on success
                })
                .catch((error) => { 
                    switch (error.code) {
                        case 'auth/user-not-found':
                        case 'auth/wrong-password':
                        case 'auth/invalid-credential': // Newer Firebase versions might use this
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
                    authMessage.style.color = 'red'; // Error message color
                    console.error("Login error:", error); 
                });
        });

        logoutButton.addEventListener("click", () => {
            signOut(auth)
                .then(() => {
                    authMessage.textContent = "Logged out successfully.";
                    authMessage.style.color = 'green'; // Success message color
                    console.log("User logged out.");
                })
                .catch((error) => { 
                    authMessage.textContent = `Logout failed: ${error.message}`; 
                    authMessage.style.color = 'red'; // Error message color
                    console.error("Logout error:", error); 
                });
        });

        loginRegisterButton.addEventListener('click', () => {
            authModal.classList.add('show');
            authMessage.textContent = ""; // Clear previous messages
            authMessage.style.color = 'red'; // Reset to default error color for new interactions
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
                    authEmailInput.value = ""; // Clear email input
                    authPasswordInput.value = ""; // Clear password input
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
            // Unsubscribe from any existing listeners before setting up new ones
            if (unsubscribeUserOrders) {
                unsubscribeUserOrders();
                unsubscribeUserOrders = null;
            }
            // Product listener is now outside the if(user) block, so don't unsubscribe here.
            if (unsubscribeAllOrders) {
                unsubscribeAllOrders();
                unsubscribeAllOrders = null;
            }

            if (user) {
                currentUserId = user.uid; // Set current user ID
                isAdmin = (currentUserId === ADMIN_UID); // Check if current user is admin

                userDisplay.textContent = `Welcome, ${user.email}`;
                loginRegisterButton.style.display = "none"; // Hide login/register button
                logoutButton.style.display = "inline-block";
                myOrdersButton.style.display = "inline-block"; // Show My Orders button

                if (isAdmin) {
                    adminPanelButton.style.display = "inline-block"; // Show Admin Panel button
                } else {
                    adminPanelButton.style.display = "none";
                }
                
                // Roblox username input is shown for logged-in users to allow placing orders
                robloxUsernameInput.style.display = "block"; 
                
                // Load cart data from Firestore for the logged-in user
                await loadCartFromFirestore(currentUserId); 
                // Synchronize local storage cart with Firestore cart upon login
                await syncCartOnLogin(currentUserId); 

                // Set up real-time listeners and store their unsubscribe functions
                unsubscribeUserOrders = setupUserOrderHistoryListener(currentUserId);
                // setupProductsListener is now always active, outside this block.
                if (isAdmin) {
                    unsubscribeAllOrders = setupAllOrdersListener();
                }

            } else {
                // If no user is logged in, reset user-related states
                currentUserId = null; // Clear user ID
                isAdmin = false; // Reset admin flag

                userDisplay.textContent = "";
                loginRegisterButton.style.display = "inline-block"; // Show login/register button
                logoutButton.style.display = "none";
                myOrdersButton.style.display = "none"; // Hide My Orders button
                adminPanelButton.style.display = "none"; // Hide Admin Panel button
                
                // Hide Roblox username input for logged-out users
                robloxUsernameInput.style.display = "none"; 

                // Load cart from local storage if logged out
                cart = loadCartFromLocalStorage(); 
                userOrders = []; // Clear orders for logged out users
                // allProducts is no longer cleared here as it's populated by a persistent listener
                allOrders = []; // Clear admin orders
            }
            // Clear authentication form fields and messages
            authEmailInput.value = "";
            authPasswordInput.value = "";
            authMessage.textContent = "";
            authMessage.style.color = 'red'; // Reset to default error color
            renderCart(); // Re-render cart based on loaded data (local storage if logged out, Firestore if logged in)
            renderProducts(allProducts); // Render products (will be empty if not fetched or if no products exist)
        });

        // --- Firestore Collection Paths ---
        // Using a static app ID for this example. In a live Canvas environment, you would use `typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';`
        const APP_ID = 'tempest-store-app'; 
        // Collection for all products, accessible to all users for reading
        const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`; 
        // Collection for a user's personal cart, private to that user
        const USER_CARTS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/carts`;
        // Collection for a user's personal orders, private to that user
        const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`;
        // Central collection for all orders, typically accessible only to admins
        const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`; 


        // --- Product Management (Firestore) ---
        // Sets up a real-time listener for product data in Firestore.
        // Any changes to products in the database will automatically update the UI.
        function setupProductsListener() {
            const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
            // Return the unsubscribe function
            return onSnapshot(productsColRef, (snapshot) => { 
                const fetchedProducts = [];
                snapshot.forEach(doc => {
                    fetchedProducts.push({ id: doc.id, ...doc.data() });
                });
                allProducts = fetchedProducts; // Update the global products array
                renderProducts(allProducts); // Re-render products on the main store page
                // If the admin panel is open and on the product management tab, re-render the admin product list
                if (adminPanelModal.classList.contains('show') && adminProductManagement.style.display !== 'none') {
                    renderAdminProducts(); 
                }
            }, (error) => {
                console.error("Error listening to products:", error);
            });
        }

        // Call setupProductsListener once when the script loads to always show products
        unsubscribeProducts = setupProductsListener();


        // Saves a product (new or existing) to Firestore.
        async function saveProductToFirestore(productData) {
            try {
                if (productData.id) { // If productData has an ID, it means we are editing an existing product
                    // Add confirmation for editing
                    if (!confirm("Are you sure you want to save changes to this product?")) {
                        return; // User cancelled the edit
                    }
                    const productRef = doc(db, PRODUCTS_COLLECTION_PATH, productData.id);
                    await updateDoc(productRef, productData);
                    console.log("Product updated:", productData.id);
                } else { // Otherwise, it's a new product to be added
                    const productsColRef = collection(db, PRODUCTS_COLLECTION_PATH);
                    await addDoc(productsColRef, productData);
                    console.log("Product added:", productData.name);
                }
                resetProductForm(); // Clear the product form after successful save
                alert("Product saved successfully!");
            } catch (e) {
                console.error("Error saving product:", e);
                alert("Error saving product: " + e.message);
            }
        }

        // Deletes a product from Firestore.
        async function deleteProductFromFirestore(productId) {
            // Confirmation prompt before deletion
            if (confirm("Are you sure you want to delete this product?")) { 
                try {
                    const productRef = doc(db, PRODUCTS_COLLECTION_PATH, productId);
                    await deleteDoc(productRef);
                    console.log("Product deleted:", productId);
                    alert("Product deleted successfully!");
                } catch (e) {
                    console.error("Error deleting product:", e);
                    alert("Error deleting product: " + e.message);
                }
            }
        }

        // Renders the list of products in the admin panel's product management table.
        function renderAdminProducts() {
            adminProductsList.innerHTML = ''; // Clear existing list
            if (allProducts.length === 0) {
                adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">No products found.</td></tr>';
                return;
            }

            allProducts.forEach(product => {
                const row = document.createElement('tr');
                // Use the filename for the image path
                const imageUrl = `images/${product.image}`;
                row.innerHTML = `
                    <td data-label="Image"><img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/50x50/f0f0f0/888?text=N/A';" /></td>
                    <td data-label="Name">${product.name}</td>
                    <td data-label="Category">${product.category}</td>
                    <td data-label="Price">
                        ${product.sale && product.salePrice ? 
                            `<span style="text-decoration: line-through; color: #888;">${product.price}</span> ${product.salePrice}` : 
                            product.price}
                    </td>
                    <td data-label="Stock">${product.stock}</td>
                    <td data-label="Status">${product.new ? 'NEW ' : ''}${product.sale ? 'SALE' : ''}</td>
                    <td data-label="Actions" class="admin-product-actions">
                        <button class="edit" data-id="${product.id}">Edit</button>
                        <button class="delete" data-id="${product.id}">Delete</button>
                    </td>
                `;
                adminProductsList.appendChild(row);
            });

            // Add event listeners for edit buttons
            adminProductsList.querySelectorAll('.edit').forEach(button => {
                button.addEventListener('click', (e) => {
                    const productId = e.target.dataset.id;
                    const productToEdit = allProducts.find(p => p.id === productId);
                    if (productToEdit) {
                        editProduct(productToEdit); // Populate form for editing
                    }
                });
            });

            // Add event listeners for delete buttons
            adminProductsList.querySelectorAll('.delete').forEach(button => {
                button.addEventListener('click', (e) => {
                    const productId = e.target.dataset.id;
                    deleteProductFromFirestore(productId); // Call delete function
                });
            });
        }

        // Populates the product form with data of a selected product for editing.
        function editProduct(product) {
            productFormTitle.textContent = "Edit Product";
            productIdInput.value = product.id; // Set the hidden ID of the product being edited
            productNameInput.value = product.name;
            productCategorySelect.value = product.category;
            productPriceInput.value = parseFloat(product.price.replace('₱', '')); // Remove '₱' for numerical input
            // Populate sale price input
            productSalePriceInput.value = product.salePrice ? parseFloat(product.salePrice.replace('₱', '')) : ''; 
            productStockInput.value = product.stock;
            // Set image filename directly
            productImageInput.value = product.image; 
            productNewCheckbox.checked = product.new || false;
            productSaleCheckbox.checked = product.sale || false;
            saveProductBtn.textContent = "Save Changes"; // Change button text to "Save Changes"
            cancelEditProductBtn.style.display = "inline-block"; // Show cancel button
        }

        // Resets the product form to its default "Add New Product" state.
        function resetProductForm() {
            productFormTitle.textContent = "Add New Product";
            productIdInput.value = ''; // Clear hidden ID
            productNameInput.value = '';
            productCategorySelect.value = 'pets';
            productPriceInput.value = '';
            productSalePriceInput.value = ''; // Clear sale price input
            productStockInput.value = '';
            productImageInput.value = ''; // Clear file input
            productNewCheckbox.checked = false;
            productSaleCheckbox.checked = false;
            saveProductBtn.textContent = "Add Product"; // Change button text back to "Add Product"
            cancelEditProductBtn.style.display = "none"; // Hide cancel button
        }

        // --- Product Form Event Listeners ---
        // Handles saving a new product or updating an existing one when the save button is clicked.
        saveProductBtn.addEventListener('click', async () => { 
            const productId = productIdInput.value;
            const isNew = productNewCheckbox.checked;
            const isSale = productSaleCheckbox.checked;
            let salePrice = null;
            let productImage = productImageInput.value.trim(); // Get filename directly

            if (isSale && productSalePriceInput.value.trim() !== '') {
                salePrice = `₱${parseFloat(productSalePriceInput.value).toFixed(2)}`;
            } else {
                salePrice = null; // Ensure salePrice is null if not on sale or empty
            }

            const newProduct = {
                name: productNameInput.value.trim(),
                category: productCategorySelect.value,
                price: `₱${parseFloat(productPriceInput.value).toFixed(2)}`, // Format price with '₱' and 2 decimal places
                salePrice: salePrice, // Include sale price
                stock: parseInt(productStockInput.value),
                image: productImage, // Use filename
                new: isNew, // Use the checked status of the 'New Product' checkbox
                sale: isSale // Use the checked status of the 'On Sale' checkbox
            };

            // Basic validation for form fields
            if (!newProduct.name || !newProduct.image || isNaN(newProduct.stock) || isNaN(parseFloat(newProduct.price.replace('₱', '')))) {
                alert("Please fill in all product fields correctly, including an image filename (e.g., product.png).");
                return;
            }
            // Validate sale price only if 'On Sale' is checked
            if (isSale && (salePrice === null || isNaN(parseFloat(salePrice.replace('₱', ''))))) {
                alert("Please enter a valid Sale Price if the product is On Sale.");
                return;
            }

            if (productId) {
                newProduct.id = productId; // Assign ID for updating existing product
            }
            saveProductToFirestore(newProduct); // Call function to save/update in Firestore
        });

        // Handles canceling product editing and resetting the form.
        cancelEditProductBtn.addEventListener('click', resetProductForm);


        // --- Firestore Cart Persistence (User-side) ---
        // Saves the current cart data to Firestore for the authenticated user.
        async function saveCartToFirestore(userId, cartData) {
            try {
                const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
                // Store cart items as a JSON string because Firestore has limitations on complex nested arrays
                await setDoc(userCartRef, { items: JSON.stringify(cartData) }); 
                console.log("Cart saved to Firestore for user:", userId);
            } catch (e) {
                console.error("Error saving cart to Firestore:", e);
            }
        }

        // Loads the cart data from Firestore for the authenticated user.
        async function loadCartFromFirestore(userId) {
            try {
                const userCartRef = doc(db, USER_CARTS_COLLECTION_PATH(userId), 'currentCart');
                const docSnap = await getDoc(userCartRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Parse the JSON string back into a JavaScript array
                    cart = JSON.parse(data.items || '[]'); 
                    console.log("Cart loaded from Firestore for user:", userId, cart);
                } else {
                    cart = []; // If no cart document exists, initialize an empty cart
                    console.log("No cart found in Firestore for user:", userId);
                }
            } catch (e) {
                console.error("Error loading cart from Firestore:", e);
                cart = []; // Fallback to empty cart on error
            }
        }

        // --- Local Storage Cart Persistence (for unauthenticated users) ---
        // Saves the cart to browser's local storage. Used when no user is authenticated.
        function saveCartToLocalStorage(cartData) {
            localStorage.setItem('tempestStoreCart', JSON.stringify(cartData));
        }

        // Loads the cart from browser's local storage. Used when no user is authenticated.
        function loadCartFromLocalStorage() {
            const storedCart = localStorage.getItem('tempestStoreCart');
            return storedCart ? JSON.parse(storedCart) : [];
        }

        // Synchronizes the local storage cart with the Firestore cart when a user logs in.
        // It merges items from the local cart into the Firestore cart and then clears the local cart.
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
                        firestoreCart[existingItemIndex].quantity += localItem.quantity;
                    } else {
                        // When syncing, ensure effectivePrice is correctly set for existing local items too.
                        const productDetails = allProducts.find(p => p.id === localItem.id);
                        const priceToUse = productDetails && productDetails.sale && productDetails.salePrice ? productDetails.salePrice : localItem.price;
                        firestoreCart.push({ ...localItem, effectivePrice: priceToUse });
                    }
                });
                cart = firestoreCart; // Update the global cart with the merged data
                await saveCartToFirestore(userId, cart); // Save merged cart back to Firestore
                localStorage.removeItem('tempestStoreCart'); // Clear local storage cart
                renderCart(); // Re-render the cart UI
            }
        }

        // --- Firestore Order History Listener (User-side) ---
        // Sets up a real-time listener for a specific user's order history in Firestore.
        function setupUserOrderHistoryListener(userId) {
            const ordersCollectionRef = collection(db, USER_ORDERS_COLLECTION_PATH(userId));
            // Query orders, ordered by date in descending order (newest first)
            const q = query(ordersCollectionRef, orderBy("orderDate", "desc"));
            // Return the unsubscribe function
            return onSnapshot(q, (snapshot) => { 
                const fetchedOrders = [];
                snapshot.forEach(doc => {
                    fetchedOrders.push({ id: doc.id, ...doc.data() });
                });
                userOrders = fetchedOrders; // Update the global userOrders array
                renderOrderHistory(); // Re-render the order history UI (if modal is open)
            }, (error) => {
                console.error("Error listening to user order history:", error);
            });
        }

        // --- Cart Management Functions ---
        // Adds a product to the cart. If the product is already in the cart, increments its quantity.
        function addToCart(product) {
            const existingItem = cart.find(item => item.id === product.id);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                // Use salePrice if available and product is on sale, otherwise use regular price
                const priceToUse = product.sale && product.salePrice ? product.salePrice : product.price;
                cart.push({ ...product, quantity: 1, effectivePrice: priceToUse }); // Store the actual price charged
            }
            saveCart(); // Persist changes to Firestore/Local Storage
            renderCart(); // Update cart UI
            console.log("Cart contents:", cart);
        }

        // Removes a product entirely from the cart.
        function removeFromCart(productId) {
            cart = cart.filter(item => item.id !== productId);
            saveCart(); // Persist changes
            renderCart(); // Update cart UI
        }

        // Updates the quantity of a specific product in the cart. Ensures quantity is at least 1.
        function updateCartQuantity(productId, newQuantity) {
            const item = cart.find(item => item.id === productId);
            if (item) {
                item.quantity = Math.max(1, newQuantity); // Ensure quantity is not less than 1
                saveCart(); // Persist changes
                renderCart(); // Update cart UI
            }
        }

        // Saves the current cart state, either to Firestore (if logged in) or Local Storage (if logged out).
        function saveCart() {
            if (currentUserId) {
                saveCartToFirestore(currentUserId, cart);
            } else {
                saveCartToLocalStorage(cart);
            }
            updateCartCountBadge(); // Update the cart count in the header and button text
        }

        // Updates the cart count badge in the header and the "Place Order" button's disabled state.
        function updateCartCountBadge() {
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            cartCountBadge.textContent = totalItems;
            cartCountBadge.style.display = totalItems > 0 ? 'inline-block' : 'none'; // Show/hide badge based on items

            const { total } = calculateCartTotals();
            placeOrderBtn.textContent = `Place Order (${totalItems} item${totalItems !== 1 ? 's' : ''}) ₱${total.toFixed(2)}`;
            
            // Disable Place Order button if cart is empty OR (logged in AND Roblox username is empty)
            placeOrderBtn.disabled = totalItems === 0 || (currentUserId && robloxUsernameInput.value.trim() === '');
        }

        // Renders all items currently in the cart within the cart modal.
        function renderCart() {
            cartItemsContainer.innerHTML = ''; // Clear existing cart items

            if (cart.length === 0) {
                cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
            } else {
                cart.forEach(item => {
                    // Use effectivePrice if available (meaning it was added as a sale item), otherwise use regular price
                    const priceToDisplay = item.effectivePrice || item.price; 
                    // Use the filename for the image path
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

                // Add event listeners for quantity control buttons
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

                // Add event listeners for remove item buttons
                cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const productId = event.target.dataset.id;
                        removeFromCart(productId);
                    });
                });
            }

            calculateCartTotals(); // Recalculate and display totals
            updateCartCountBadge(); // Update badge and button
        }

        // Calculates the subtotal, shipping, and total price of items in the cart.
        function calculateCartTotals() {
            let subtotal = 0;
            let totalItemsInCart = 0;
            cart.forEach(item => {
                // Use effectivePrice if available (meaning it was added as a sale item), otherwise use regular price
                const priceValue = parseFloat((item.effectivePrice || item.price).replace('₱', '')); 
                subtotal += priceValue * item.quantity;
                totalItemsInCart += item.quantity;
            });

            // Shipping calculation is removed, total is now just subtotal
            const total = subtotal; 

            cartSubtotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
            cartTotalSpan.textContent = `₱${total.toFixed(2)}`;

            return { subtotal, total, totalItemsInCart }; 
        }

        // --- Cart Modal Event Listeners ---
        // Opens the cart modal and renders its contents.
        cartIconBtn.addEventListener('click', () => {
            cartModal.classList.add('show');
            renderCart();
            // Show Roblox username input only if a user is logged in
            robloxUsernameInput.style.display = currentUserId ? 'block' : 'none'; 
            updateCartCountBadge();
        });

        // Closes the cart modal.
        closeCartModalBtn.addEventListener('click', () => {
            cartModal.classList.remove('show');
        });

        // Closes the cart modal if clicking outside the modal box.
        cartModal.addEventListener('click', (event) => {
            if (event.target === cartModal) {
                cartModal.classList.remove('show');
            }
        });

        // Updates the "Place Order" button's disabled state whenever the Roblox username input changes.
        robloxUsernameInput.addEventListener('input', updateCartCountBadge);

        // Handles the process of placing an order.
        placeOrderBtn.addEventListener('click', async () => {
            if (cart.length === 0) {
                alert("Your cart is empty. Please add items before placing an order.");
                return;
            }

            const robloxUsername = robloxUsernameInput.value.trim();

            // Disable the button to prevent multiple clicks
            placeOrderBtn.disabled = true;

            try {
                if (!currentUserId) {
                    // If user is not logged in, show auth modal and guide them
                    authModal.classList.add('show');
                    authMessage.textContent = "Please login or register to complete your order.";
                    authEmailInput.value = ""; // Clear for a fresh start
                    authPasswordInput.value = ""; // Clear for a fresh start
                    placeOrderBtn.disabled = false; // Re-enable if we're just showing the auth modal
                    return; // Stop checkout process until authenticated
                }
                
                // Require Roblox username if logged in
                if (robloxUsername === '') {
                    alert("Please enter your Roblox Username to proceed with the order.");
                    placeOrderBtn.disabled = false; // Re-enable if validation fails
                    return; 
                }

                const { subtotal, total } = calculateCartTotals(); 
                const orderDetails = {
                    userId: currentUserId,
                    // Deep copy cart items to ensure order details are immutable if cart changes later
                    items: JSON.parse(JSON.stringify(cart)), 
                    subtotal: subtotal,
                    total: total,
                    orderDate: new Date().toISOString(), // Store order date as ISO string for consistent sorting
                    status: 'Pending', // Initial status of the order
                    paymentMethod: document.querySelector('input[name="payment-method"]:checked').value, // Get selected payment method
                    robloxUsername: robloxUsername 
                };

                console.log("Placing Order:", orderDetails);

                // Save the order to the user's personal orders collection
                const userOrdersColRef = collection(db, USER_ORDERS_COLLECTION_PATH(currentUserId));
                const userOrderDocRef = await addDoc(userOrdersColRef, orderDetails);

                // Save a copy of the order to the central 'allOrders' collection for admin panel viewing.
                // Uses the same ID as the user's order for easy lookup.
                const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
                await setDoc(doc(allOrdersColRef, userOrderDocRef.id), orderDetails); 

                alert("Successfully Placed Order!"); // Success message
                console.log("Order saved to Firestore!");
                
                // Clear the cart, update UI, and close modal after successful order placement
                cart = [];
                saveCart();
                renderCart();
                cartModal.classList.remove('show');
                robloxUsernameInput.value = ''; // Clear Roblox username input field

            } catch (e) {
                console.error("Error placing order to Firestore:", e);
                alert("There was an error placing your order. Please try again.");
            } finally {
                placeOrderBtn.disabled = false; // Re-enable the button
            }
        });


        // --- Order History Functions (User-side) ---
        // Opens the order history modal and displays the list of orders.
        myOrdersButton.addEventListener('click', () => {
            if (!currentUserId) {
                alert("Please log in to view your order history."); 
                return;
            }
            orderHistoryModal.classList.add('show');
            orderHistoryTitle.textContent = "My Orders";
            orderHistoryList.style.display = 'block'; // Show list view
            orderDetailsView.style.display = 'none'; // Hide detail view
            renderOrderHistory(); // Render the orders list
        });

        // Closes the order history modal.
        closeOrderHistoryModalBtn.addEventListener('click', () => {
            orderHistoryModal.classList.remove('show');
        });

        // Closes the order history modal if clicking outside the modal box.
        orderHistoryModal.addEventListener('click', (event) => {
            if (event.target === orderHistoryModal) {
                orderHistoryModal.classList.remove('show'); 
            }
        });

        // Navigates back from order details view to the main order history list.
        backToOrderListBtn.addEventListener('click', () => {
            orderHistoryList.style.display = 'block';
            orderDetailsView.style.display = 'none';
            orderHistoryTitle.textContent = "My Orders";
            renderOrderHistory();
        });

        // Renders the list of user's orders in the order history modal.
        function renderOrderHistory() {
            orderHistoryList.innerHTML = ''; // Clear existing list

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

            // Add event listeners to "View Details" buttons
            orderHistoryList.querySelectorAll('.view-details-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const orderId = event.target.dataset.orderId;
                    const selectedOrder = userOrders.find(order => order.id === orderId);
                    if (selectedOrder) {
                        showOrderDetails(selectedOrder); // Show detailed view of the order
                    }
                });
            });
        }

        // Displays the detailed information of a selected order.
        function showOrderDetails(order) {
            orderHistoryTitle.textContent = "Order Details";
            orderHistoryList.style.display = 'none'; // Hide list
            orderDetailsView.style.display = 'block'; // Show details

            // Populate order details fields
            detailOrderId.textContent = order.id;
            detailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
            detailOrderStatus.textContent = order.status;
            detailOrderStatus.className = `status-info order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;
            detailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
            detailPaymentMethod.textContent = order.paymentMethod;
            detailRobloxUsername.textContent = order.robloxUsername || 'N/A';

            detailItemsList.innerHTML = ''; // Clear existing items list
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'order-detail-item';
                    const imageUrl = `images/${item.image}`; // Use filename for image path
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

        // --- Admin Panel Functions ---
        // Opens the admin panel modal.
        adminPanelButton.addEventListener('click', () => {
            if (!isAdmin) {
                alert("You are not authorized to access the Admin Panel.");
                return;
            }
            adminPanelModal.classList.add('show');
            // Default to product management tab when opening
            showAdminTab('products');
        });

        // Closes the admin panel modal.
        closeAdminPanelModalBtn.addEventListener('click', () => {
            adminPanelModal.classList.remove('show');
        });

        // Closes the admin panel modal if clicking outside the modal box.
        adminPanelModal.addEventListener('click', (event) => {
            if (event.target === adminPanelModal) {
                adminPanelModal.classList.remove('show');
            }
        });

        // Handles switching between different tabs within the admin panel (e.g., Product Management, Order Management).
        adminTabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                showAdminTab(tab);
            });
        });

        // Shows the selected admin tab and hides others.
        function showAdminTab(tabName) {
            adminTabButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });

            adminProductManagement.style.display = 'none';
            adminOrderManagement.style.display = 'none';

            if (tabName === 'products') {
                adminProductManagement.style.display = 'block';
                resetProductForm(); // Ensure product form is reset when switching to this tab
                renderAdminProducts(); // Render product list for admin
            } else if (tabName === 'orders') {
                adminOrderManagement.style.display = 'block';
                adminOrderDetailsView.style.display = 'none'; // Ensure order details view is hidden on tab switch
                renderAdminOrders(); // Render all orders for admin
            }
        }

        // --- Order Management (Admin-side) ---
        // Sets up a real-time listener for all orders in Firestore (for admin view).
        function setupAllOrdersListener() {
            const allOrdersColRef = collection(db, ALL_ORDERS_COLLECTION_PATH);
            // Query all orders, ordered by date in descending order (newest first)
            const q = query(allOrdersColRef, orderBy("orderDate", "desc"));
            // Return the unsubscribe function
            return onSnapshot(q, (snapshot) => { 
                const fetchedOrders = [];
                snapshot.forEach(doc => {
                    fetchedOrders.push({ id: doc.id, ...doc.data() });
                });
                allOrders = fetchedOrders; 
                renderAdminOrders(); // Re-render the admin orders table (if admin panel is open)
            }, (error) => {
                console.error("Error listening to all orders:", error);
            });
        }

        // Renders the list of all orders in the admin panel's order management table.
        function renderAdminOrders() {
            adminOrdersList.innerHTML = ''; // Clear existing list
            if (allOrders.length === 0) {
                adminOrdersList.innerHTML = '<tr><td colspan="6" class="empty-message">No orders found.</td></tr>';
                return;
            }

            allOrders.forEach(order => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="Order ID">${order.id.substring(0, 8)}...</td>
                    <td data-label="User ID">${order.userId ? order.userId.substring(0, 8) + '...' : 'N/A'}</td>
                    <td data-label="Date">${new Date(order.orderDate).toLocaleDateString()}</td>
                    <td data-label="Total">₱${order.total.toFixed(2)}</td>
                    <td data-label="Status"><span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}}">${order.status}</span></td>
                    <td data-label="Actions" class="admin-order-actions">
                        <button class="view" data-id="${order.id}">View</button>
                    </td>
                `;
                adminOrdersList.appendChild(row);
            });

            // Add event listeners to "View" buttons for detailed order view
            adminOrdersList.querySelectorAll('.view').forEach(button => {
                button.addEventListener('click', (e) => {
                    const orderId = e.target.dataset.id;
                    const selectedOrder = allOrders.find(order => order.id === orderId);
                    if (selectedOrder) {
                        showAdminOrderDetails(selectedOrder); // Show detailed view for admin
                    }
                });
            });
        }

        // Displays the detailed information of a selected order for admin.
        function showAdminOrderDetails(order) {
            currentEditingOrderId = order.id; // Store the ID of the order being viewed/edited
            adminOrdersList.parentElement.style.display = 'none'; // Hide the orders table
            adminOrderDetailsView.style.display = 'block'; // Show the order details view

            // Populate detailed order information
            adminDetailOrderId.textContent = order.id;
            adminDetailUserId.textContent = order.userId || 'N/A';
            adminDetailRobloxUsername.textContent = order.robloxUsername || 'N/A';
            adminDetailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
            adminDetailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
            adminDetailPaymentMethod.textContent = order.paymentMethod;
            adminDetailOrderStatus.textContent = order.status;
            adminDetailOrderStatus.className = `status-info order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;

            // Set the status dropdown to the current order's status for easy update
            orderStatusSelect.value = order.status;

            adminDetailItemsList.innerHTML = ''; // Clear existing items list
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'admin-order-detail-item';
                    const imageUrl = `images/${item.image}`; // Use filename for image path
                    itemDiv.innerHTML = `
                        <span class="admin-order-detail-item-name">${item.name}</span>
                        <span class="admin-order-detail-item-qty-price">Qty: ${item.quantity} - ${item.effectivePrice || item.price}</span>
                    `;
                    adminDetailItemsList.appendChild(itemDiv);
                });
            } else {
                adminDetailItemsList.innerHTML = '<p>No items found for this order.</p>';
            }
        }

        // Navigates back from admin order details view to the all orders list.
        adminBackToOrderListBtn.addEventListener('click', () => {
            adminOrdersList.parentElement.style.display = 'table'; // Show the orders table
            adminOrderDetailsView.style.display = 'none'; // Hide the order details view
            currentEditingOrderId = null; // Clear the ID of the order being edited
        });

        // Handles updating the status of an order in Firestore.
        updateOrderStatusBtn.addEventListener('click', async () => {
            if (!currentEditingOrderId) {
                alert("No order selected for status update.");
                return;
            }

            const newStatus = orderStatusSelect.value;
            try {
                // Update the order status in the central 'allOrders' collection
                const orderRef = doc(db, ALL_ORDERS_COLLECTION_PATH, currentEditingOrderId);
                await updateDoc(orderRef, { status: newStatus });

                // Also update the status in the user's personal order history to keep them synchronized
                const orderToUpdate = allOrders.find(o => o.id === currentEditingOrderId);
                if (orderToUpdate && orderToUpdate.userId) {
                    const userOrderRef = doc(db, USER_ORDERS_COLLECTION_PATH(orderToUpdate.userId), currentEditingOrderId);
                    await updateDoc(userOrderRef, { status: newStatus });
                }

                alert(`Order ${currentEditingOrderId.substring(0, 8)}... status updated to ${newStatus}.`);
                // After updating, go back to the all orders list
                adminBackToOrderListBtn.click();
            } catch (e) {
                console.error("Error updating order status:", e);
                alert("Error updating order status: " + e.message);
            }
        });


        // --- Initial product data (This array is now only a fallback if Firestore is completely empty) ---
        // In a deployed application, you would typically remove this static data and rely solely on Firestore.
        const staticProductsFallback = [
            { id: 'p001', name: "Queen Bee", category: "pets", price: "₱100", new: true, stock: 999, image: "queenbee.png" },
            { id: 'p002', name: "Petal Bee", category: "pets", price: "₱10", new: true, stock: 999, image: "Petalbee.webp" },
            { id: 'p003', name: "Bear Bee", category: "pets", price: "₱10", new: true, stock: 999, image: "Bearbeee1.webp" },
            { id: 'p004', name: "Dragon Fly", category: "pets", price: "₱150", new: true, stock: 999, image: "DragonflyIcon.webp" },
            { id: 'p005', name: "1T Sheckle", category: "sheckles", price: "₱5", new: true, stock: 999, image: "sheckles.png" },
            { id: 'p006', name: "Raccoon", category: "pets", price: "₱250", new: true, stock: 999, image: "Raccon_Better_Quality.webp" },
            { id: 'p007', name: "Butterfly", category: "pets", price: "₱180", new: true, stock: 999, image: "Thy_Butterfly_V2.webp" },
            { id: 'p008', name: "Red Fox", category: "pets", price: "₱25", new: true, stock: 999, image: "RedFox.webp" },
            { id: 'p009', name: "Chicken Zombie", category: "pets", price: "₱25", new: true, stock: 999, image: "Chicken_Zombie_Icon.webp" },
            { id: 'p010', name: "Disco Bee", category: "pets", price: "₱200", new: true, stock: 999, image: "DiscoBeeIcon.webp" },
            { id: 'p011', name: "Chocolate Sprinkler", category: "gears", price: "₱25", new: true, stock: 999, image: "ChocolateSprinkler.webp" },
            { id: 'p012', name: "Master Sprinkler", category: "gears", price: "₱10", new: true, stock: 999, image: "MasterSprinkler.webp" },
            { id: 'p013', name: "Lightning Rod", category: "gears", price: "₱10", new: true, stock: 999, image: "Lightning_Rod.webp" },
            { id: 'p014', name: "Turtle", category: "pets", price: "₱10", new: true, stock: 999, image: "Turtle_icon.webp" },
            { id: 'p015', name: "Honey Sprinkler", category: "gears", price: "₱15", new: true, stock: 999, image: "HoneySprinklerRender.webp" },
            { id: 'p016', name: "Godly Sprinkler", category: "gears", price: "₱5", new: true, stock: 999, image: "Godly_Sprinkler.webp" },
            { id: 'p017', name: "Sprinkler Method", category: "gears", price: "₱15", new: true, stock: 999, image: "sprinklermethod.png" },
            { id: 'p018', name: "Polar Bear", category: "pets", price: "₱10", new: true, stock: 999, image: "Polarbear.webp" },
        ];

        let currentCategory = "all";

        // Renders the products on the main storefront based on the provided array of items.
        function renderProducts(items) {
            const list = document.getElementById("product-list");
            list.innerHTML = ""; // Clear existing product cards

            if (items.length === 0) {
                 list.innerHTML = '<p class="empty-message" style="width: 100%;">No products available. Please add some from the Admin Panel!</p>';
                 return;
            }

            items.forEach(product => {
                const card = document.createElement("div");
                card.className = "card";
                const isOutOfStock = !product.stock || product.stock <= 0;
                if (isOutOfStock) card.classList.add("out-of-stock"); // Add class for styling out-of-stock items

                // Determine which price to display: sale price if applicable, otherwise regular price
                const displayPrice = product.sale && product.salePrice ? 
                                     `<span style="text-decoration: line-through; color: #888; font-size: 0.9em;">${product.price}</span> ${product.salePrice}` : 
                                     product.price;
                // Use the filename for the image path
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

            // Add event listeners to "Add to Cart" buttons
            document.querySelectorAll('.add-to-cart-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const productId = event.target.dataset.productId;
                    const productToAdd = allProducts.find(p => p.id === productId); 
                    if (productToAdd) {
                        addToCart(productToAdd); // Add the selected product to the cart
                    }
                });
            });
        }

        // Sets the current category filter and triggers a re-render of products.
        function setFilter(category) {
            currentCategory = category;

            // Update active state of filter buttons
            document.querySelectorAll(".filters button").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.cat === category);
            });

            applyFilters(); // Re-apply filters to update product display
        }

        // Applies category and search term filters to the product list and renders the results.
        function applyFilters() {
            const query = document.getElementById("searchBox").value.toLowerCase();

            const filtered = allProducts.filter(product => { 
                const matchesCategory = currentCategory === "all" || product.category === currentCategory;
                const matchesSearch = product.name.toLowerCase().includes(query);
                return matchesCategory && matchesSearch;
            });

            renderProducts(filtered); // Render the filtered products
        }

        // Event listener for when the DOM content is fully loaded.
        window.addEventListener("DOMContentLoaded", () => {
            updateCartCountBadge(); // Initialize cart count badge on page load
        });
