// script.js - Customer-Facing Logic
// This script assumes Firebase has been initialized and
// global variables like window.db, window.auth, window.currentUser,
// window.userId, window.isAdmin, window.firebaseLoading, window.openMessage,
// window.openModal, window.closeModal, window.USER_FIREBASE_CONFIG,
// window.ADMIN_UID, and utility functions are available from index.html.

document.addEventListener('DOMContentLoaded', () => {
    // --- Global DOM Elements ---
    const mainContent = document.getElementById('main-content');
    const authButtonsContainer = document.getElementById('auth-buttons');
    const cartItemCountSpan = document.getElementById('cart-item-count');

    // --- Login/Register Modal Elements ---
    const loginRegisterModal = document.getElementById('login-register-modal');
    const loginRegisterTitle = document.getElementById('login-register-title');
    const authForm = document.getElementById('auth-form');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const confirmPasswordGroup = document.getElementById('confirm-password-group');
    const authConfirmPasswordInput = document.getElementById('auth-confirm-password');
    const authErrorMessage = document.getElementById('auth-error-message');
    const authSubmitButton = document.getElementById('auth-submit-button');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authToggleButton = document.getElementById('auth-toggle-button');

    let isLoginMode = true; // State for login/register modal

    // --- Cart & Checkout Modal Elements ---
    const checkoutModal = document.getElementById('checkout-modal');
    const checkoutItemsList = document.getElementById('checkout-items-list');
    const checkoutTotalSpan = document.getElementById('checkout-total');
    const paymentMethodRadios = document.querySelectorAll('#checkout-modal input[name="paymentMethod"]');
    const robloxUsernameGroup = document.getElementById('roblox-username-group');
    const robloxUsernameInput = document.getElementById('roblox-username');
    const placeOrderButton = document.getElementById('place-order-button');
    const paymentImageModal = document.getElementById('payment-image-modal');
    const paymentInstructionsMessage = document.getElementById('payment-instructions-message');
    const currentPaymentImage = document.getElementById('current-payment-image');
    const confirmPaymentOrderButton = document.getElementById('confirm-payment-order-button');

    // --- Global State Variables ---
    let currentCartItems = []; // Array to hold cart items from Firestore
    let allProducts = [];      // Array to hold all products from Firestore
    const categories = ['All', 'Pets', 'Gears', 'Sheckles']; // Static categories for now
    let selectedCategory = 'All';
    let searchTerm = '';

    // --- Utility Functions (also defined in index.html for global access) ---
    // window.openMessage, window.openModal, window.closeModal are assumed from index.html

    /**
     * Updates the header's authentication buttons based on current user status.
     */
    function updateAuthUI() {
        authButtonsContainer.innerHTML = ''; // Clear existing buttons
        if (window.firebaseLoading) {
            authButtonsContainer.innerHTML = '<div class="text-gray-400">Loading...</div>';
            return;
        }

        if (window.currentUser) {
            let userEmailDisplay = window.currentUser.email || 'User';
            // Truncate long emails for mobile display
            if (userEmailDisplay.length > 20 && window.innerWidth < 768) {
                userEmailDisplay = userEmailDisplay.substring(0, 17) + '...';
            }

            authButtonsContainer.innerHTML = `
                <span class="text-sm md:text-base hidden sm:inline">Welcome, ${userEmailDisplay}</span>
                <button id="logout-button" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300 text-sm">
                    Logout
                </button>
                <button id="my-orders-button" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300 text-sm">
                    My Orders
                </button>
                ${window.isAdmin ? `
                <button id="admin-panel-button" class="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300 text-sm">
                    Admin Panel
                </button>` : ''}
            `;

            document.getElementById('logout-button').addEventListener('click', handleLogout);
            document.getElementById('my-orders-button').addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('navigateTo', { detail: 'my-orders' }));
            });
            if (window.isAdmin) {
                document.getElementById('admin-panel-button').addEventListener('click', () => {
                    document.dispatchEvent(new CustomEvent('navigateTo', { detail: 'admin-panel' }));
                });
            }
        } else {
            authButtonsContainer.innerHTML = `
                <button id="login-register-open-button" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 md:px-4 rounded-lg transition duration-300 text-sm">
                    Login / Register
                </button>
            `;
            document.getElementById('login-register-open-button').addEventListener('click', () => {
                isLoginMode = true; // Default to login when opening
                updateLoginRegisterModalUI();
                window.openModal('login-register-modal');
            });
        }
    }

    /**
     * Updates the UI of the login/register modal based on `isLoginMode`.
     */
    function updateLoginRegisterModalUI() {
        loginRegisterTitle.textContent = isLoginMode ? 'Login' : 'Register';
        authSubmitButton.textContent = isLoginMode ? 'Login' : 'Register';
        authToggleText.textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
        authToggleButton.textContent = isLoginMode ? 'Register here' : 'Login here';
        if (isLoginMode) {
            confirmPasswordGroup.classList.add('hidden');
            authConfirmPasswordInput.removeAttribute('required');
        } else {
            confirmPasswordGroup.classList.remove('hidden');
            authConfirmPasswordInput.setAttribute('required', 'required');
        }
        authErrorMessage.classList.add('hidden'); // Clear previous errors
        authErrorMessage.textContent = '';
    }

    /**
     * Handles the submit action for login/registration.
     * @param {Event} e - The form submit event.
     */
    async function handleAuthFormSubmit(e) {
        e.preventDefault();
        authErrorMessage.classList.add('hidden'); // Hide any previous error messages

        const email = authEmailInput.value;
        const password = authPasswordInput.value;
        const confirmPassword = authConfirmPasswordInput.value;

        if (!email || !password) {
            authErrorMessage.textContent = 'Email and password are required.';
            authErrorMessage.classList.remove('hidden');
            return;
        }

        if (!isLoginMode && password !== confirmPassword) {
            authErrorMessage.textContent = 'Passwords do not match.';
            authErrorMessage.classList.remove('hidden');
            return;
        }

        authSubmitButton.disabled = true;
        authSubmitButton.textContent = 'Loading...';

        let result;
        if (isLoginMode) {
            // Login logic
            try {
                const userCredential = await window.signInWithEmailAndPassword(window.auth, email, password);
                result = { success: true, user: userCredential.user };
            } catch (error) {
                result = { error: error.message };
            }
        } else {
            // Register logic
            try {
                const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, password);
                result = { success: true, user: userCredential.user };
            } catch (error) {
                result = { error: error.message };
            }
        }

        if (result.error) {
            authErrorMessage.textContent = result.error;
            authErrorMessage.classList.remove('hidden');
        } else {
            window.openMessage(isLoginMode ? 'Logged in successfully!' : 'Registration successful! You are now logged in.', 'success');
            window.closeModal('login-register-modal');
            authEmailInput.value = '';
            authPasswordInput.value = '';
            authConfirmPasswordInput.value = '';
        }

        authSubmitButton.disabled = false;
        authSubmitButton.textContent = isLoginMode ? 'Login' : 'Register';
    }

    /**
     * Handles user logout.
     */
    async function handleLogout() {
        if (!window.auth) return;
        try {
            await window.signOut(window.auth);
            window.openMessage('Logged out successfully!', 'success');
            // Navigate back to products page after logout
            document.dispatchEvent(new CustomEvent('navigateTo', { detail: 'products' }));
        } catch (error) {
            console.error("Logout failed:", error);
            window.openMessage(`Logout failed: ${error.message}`, 'error');
        }
    }

    // --- Product List Rendering ---

    /**
     * Renders a single product card.
     * @param {object} product - The product data.
     * @returns {string} HTML string for the product card.
     */
    function renderProductCard(product) {
        const isOutOfStock = product.stock <= 0;
        const showSaleBadge = product.isOnSale && product.salePrice && product.salePrice < product.price;
        const showNewBadge = product.isNew;
        const displayPrice = showSaleBadge ? product.salePrice.toFixed(2) : product.price.toFixed(2);
        const originalPriceHtml = showSaleBadge ? `<span class="block text-sm text-gray-500 line-through">₱${product.price.toFixed(2)}</span>` : '';

        // Ensure image URL exists and defaults gracefully
        const imageUrl = product.imageUrl && product.imageUrl.startsWith('/images/')
            ? product.imageUrl
            : `https://placehold.co/400x300/F0F4F8/1F2937?text=${product.name.replace(/\s/g, '+')}`;

        return `
            <div class="product-card">
                ${showSaleBadge ? '<span class="badge-sale">SALE</span>' : ''}
                ${showNewBadge ? '<span class="badge-new">NEW</span>' : ''}
                <img src="${imageUrl}" alt="${product.name}" class="product-image"
                     onerror="this.onerror=null; this.src='https://placehold.co/400x300/F0F4F8/1F2937?text=Image+Not+Found';" />
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-description">${product.description || 'No description available.'}</p>
                    <div class="product-footer">
                        <div>
                            <span class="product-price">₱${displayPrice}</span>
                            ${originalPriceHtml}
                            <p class="text-sm text-gray-500">Stock: ${product.stock}</p>
                        </div>
                        <button data-product-id="${product.id}"
                                class="product-add-to-cart ${isOutOfStock || !window.currentUser ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}"
                                ${isOutOfStock || !window.currentUser ? 'disabled' : ''}>
                            ${isOutOfStock ? 'Out of Stock' : (window.currentUser ? 'Add to Cart' : 'Login to Add')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renders the product list page with filters and search.
     */
    function renderProductListPage() {
        mainContent.innerHTML = `
            <div class="container mx-auto p-6 flex flex-col gap-6">
                <div class="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-white rounded-lg shadow-md">
                    <div id="category-buttons" class="flex flex-wrap justify-center sm:justify-start gap-2">
                        ${categories.map(cat => `
                            <button data-category="${cat}" class="px-4 py-2 rounded-full text-sm font-medium transition duration-300
                                ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}">
                                ${cat}
                            </button>
                        `).join('')}
                    </div>
                    <div class="relative w-full sm:w-auto">
                        <input type="text" id="product-search-input" placeholder="Search products..."
                            class="pl-10 pr-4 py-2 border rounded-full w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value="${searchTerm}">
                        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </div>
                </div>
                <div id="product-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    <!-- Product cards will be injected here -->
                </div>
                <div id="no-products-message" class="text-center py-10 text-gray-600 text-xl hidden">No products found matching your criteria.</div>
            </div>
        `;

        // Attach event listeners for category buttons
        document.getElementById('category-buttons').querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                selectedCategory = e.target.dataset.category;
                filterAndRenderProducts();
            });
        });

        // Attach event listener for search input
        document.getElementById('product-search-input').addEventListener('input', (e) => {
            searchTerm = e.target.value;
            filterAndRenderProducts();
        });

        filterAndRenderProducts(); // Initial rendering of products
    }

    /**
     * Filters products based on selected category and search term, then renders them.
     */
    function filterAndRenderProducts() {
        let currentProducts = allProducts;

        // Filter by category
        if (selectedCategory !== 'All') {
            currentProducts = currentProducts.filter(
                (product) => product.category && product.category.toLowerCase() === selectedCategory.toLowerCase()
            );
        }

        // Filter by search term
        if (searchTerm) {
            currentProducts = currentProducts.filter((product) =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        const productGrid = document.getElementById('product-grid');
        const noProductsMessage = document.getElementById('no-products-message');

        if (currentProducts.length === 0) {
            productGrid.innerHTML = '';
            noProductsMessage.classList.remove('hidden');
        } else {
            productGrid.innerHTML = currentProducts.map(renderProductCard).join('');
            noProductsMessage.classList.add('hidden');

            // Attach add to cart listeners
            productGrid.querySelectorAll('.product-add-to-cart').forEach(button => {
                button.addEventListener('click', (e) => {
                    const productId = e.target.dataset.productId;
                    const productToAdd = allProducts.find(p => p.id === productId);
                    if (productToAdd) {
                        handleAddToCart(productToAdd);
                    }
                });
            });
        }
    }


    /**
     * Handles adding a product to the cart (Firestore).
     * @param {object} product - The product to add.
     */
    async function handleAddToCart(product) {
        if (!window.db || !window.userId) {
            window.openMessage("Please log in to add items to your cart.", 'error');
            isLoginMode = true; // Ensure login modal opens in login mode
            updateLoginRegisterModalUI();
            window.openModal('login-register-modal');
            return;
        }

        const cartItemRef = window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/users/${window.userId}/cart`, product.id);
        try {
            const docSnap = await window.getDoc(cartItemRef);
            let quantityToAdd = 1;

            if (docSnap.exists()) {
                // Item already in cart, increment quantity
                const currentQuantity = docSnap.data().quantity;
                if (product.stock > currentQuantity) {
                    await window.updateDoc(cartItemRef, { quantity: currentQuantity + 1 });
                    window.openMessage(`${product.name} quantity updated in cart!`, 'success');
                } else {
                    window.openMessage(`Cannot add more ${product.name}, out of stock!`, 'error');
                    return;
                }
            } else {
                // Item not in cart, add new
                if (product.stock > 0) {
                    await window.setDoc(cartItemRef, {
                        productId: product.id,
                        name: product.name,
                        price: product.isOnSale ? product.salePrice : product.price,
                        imageUrl: product.imageUrl,
                        quantity: quantityToAdd,
                    });
                    window.openMessage(`${product.name} added to cart!`, 'success');
                } else {
                    window.openMessage(`${product.name} is out of stock!`, 'error');
                    return;
                }
            }
        } catch (error) {
            console.error("Error adding to cart:", error);
            window.openMessage(`Failed to add ${product.name} to cart: ${error.message}`, 'error');
        }
    }


    // --- Cart Page Rendering ---

    /**
     * Renders the cart page content.
     */
    function renderCartPage() {
        mainContent.innerHTML = `
            <div class="container mx-auto p-6">
                <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Your Shopping Cart</h2>
                <div id="cart-content-area" class="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <!-- Cart items table or empty message will be injected here -->
                </div>
            </div>
        `;
        updateCartDisplay(); // Initial display of cart items
    }

    /**
     * Updates the cart table and total based on `currentCartItems` data.
     */
    function updateCartDisplay() {
        const cartContentArea = document.getElementById('cart-content-area');
        if (!cartContentArea) return;

        if (currentCartItems.length === 0) {
            cartContentArea.innerHTML = `
                <div class="text-center py-10">
                    <p class="text-xl text-gray-600 mb-4">Your cart is empty.</p>
                    <button id="start-shopping-button" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300">
                        Start Shopping
                    </button>
                </div>
            `;
            document.getElementById('start-shopping-button').addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('navigateTo', { detail: 'products' }));
            });
            return;
        }

        let subtotal = 0;
        currentCartItems.forEach(item => {
            subtotal += item.price * item.quantity;
        });

        cartContentArea.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th scope="col" class="relative px-6 py-3"><span class="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody id="cart-items-table-body" class="bg-white divide-y divide-gray-200">
                        ${currentCartItems.map(item => `
                            <tr data-item-id="${item.id}">
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center">
                                        <div class="flex-shrink-0 h-10 w-10">
                                            <img class="h-10 w-10 rounded-full object-cover"
                                                 src="${item.imageUrl || `https://placehold.co/40x40/F0F4F8/1F2937?text=${item.name.charAt(0)}`}"
                                                 alt="${item.name}"
                                                 onerror="this.onerror=null; this.src='https://placehold.co/40x40/F0F4F8/1F2937?text=?';" />
                                        </div>
                                        <div class="ml-4">
                                            <div class="text-sm font-medium text-gray-900">${item.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm text-gray-900">₱${item.price.toFixed(2)}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center">
                                        <button data-action="decrement" data-item-id="${item.id}" class="px-2 py-1 border border-gray-300 rounded-l-md text-gray-700 hover:bg-gray-100">-</button>
                                        <span class="px-3 py-1 border-t border-b border-gray-300 text-sm">${item.quantity}</span>
                                        <button data-action="increment" data-item-id="${item.id}" class="px-2 py-1 border border-gray-300 rounded-r-md text-gray-700 hover:bg-gray-100">+</button>
                                    </div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ₱${(item.price * item.quantity).toFixed(2)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button data-action="remove" data-item-id="${item.id}" class="text-red-600 hover:text-red-900 ml-4">Remove</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="mt-8 flex justify-end items-center border-t pt-4">
                <div class="text-lg font-bold text-gray-900">Subtotal: ₱${subtotal.toFixed(2)}</div>
            </div>
            <div class="mt-4 flex justify-end">
                <button id="proceed-to-checkout-button" class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300 shadow-md">
                    Proceed to Checkout
                </button>
            </div>
        `;

        // Attach event listeners for cart quantity and remove buttons
        cartContentArea.querySelectorAll('button[data-action="decrement"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                const item = currentCartItems.find(i => i.id === itemId);
                if (item) handleUpdateCartItemQuantity(item, item.quantity - 1);
            });
        });
        cartContentArea.querySelectorAll('button[data-action="increment"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                const item = currentCartItems.find(i => i.id === itemId);
                if (item) handleUpdateCartItemQuantity(item, item.quantity + 1);
            });
        });
        cartContentArea.querySelectorAll('button[data-action="remove"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                const item = currentCartItems.find(i => i.id === itemId);
                if (item) handleRemoveCartItem(item);
            });
        });

        document.getElementById('proceed-to-checkout-button').addEventListener('click', handleProceedToCheckout);

        // Update header cart count
        cartItemCountSpan.textContent = currentCartItems.reduce((count, item) => count + item.quantity, 0);
        cartItemCountSpan.classList.toggle('hidden', currentCartItems.length === 0);
    }

    /**
     * Updates the quantity of a cart item in Firestore.
     * @param {object} item - The cart item object.
     * @param {number} newQuantity - The new quantity for the item.
     */
    async function handleUpdateCartItemQuantity(item, newQuantity) {
        if (!window.db || !window.userId) return;

        const cartDocRef = window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/users/${window.userId}/cart`, item.id);
        if (newQuantity <= 0) {
            await window.deleteDoc(cartDocRef);
            window.openMessage(`${item.name} removed from cart.`, 'success');
        } else {
            // Check against actual product stock before updating cart quantity
            const productRef = window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`, item.productId);
            try {
                const productSnap = await window.getDoc(productRef);
                if (productSnap.exists()) {
                    const productStock = productSnap.data().stock;
                    if (newQuantity <= productStock) {
                        await window.updateDoc(cartDocRef, { quantity: newQuantity });
                        window.openMessage(`${item.name} quantity updated.`, 'success');
                    } else {
                        window.openMessage(`Cannot add more ${item.name}. Only ${productStock} in stock.`, 'error');
                    }
                } else {
                    window.openMessage(`Product ${item.name} not found in inventory.`, 'error');
                }
            } catch (error) {
                console.error("Error updating cart quantity:", error);
                window.openMessage(`Failed to update quantity for ${item.name}.`, 'error');
            }
        }
    }

    /**
     * Removes a cart item from Firestore.
     * @param {object} item - The cart item object to remove.
     */
    async function handleRemoveCartItem(item) {
        if (!window.db || !window.userId) return;
        const cartDocRef = window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/users/${window.userId}/cart`, item.id);
        try {
            await window.deleteDoc(cartDocRef);
            window.openMessage(`${item.name} removed from cart.`, 'success');
        } catch (error) {
            console.error("Error removing cart item:", error);
            window.openMessage(`Failed to remove ${item.name} from cart.`, 'error');
        }
    }

    /**
     * Handles the "Proceed to Checkout" button click.
     */
    function handleProceedToCheckout() {
        if (!window.currentUser) {
            window.openMessage('Please log in to place an order.', 'error');
            isLoginMode = true;
            updateLoginRegisterModalUI();
            window.openModal('login-register-modal');
            return;
        }
        if (currentCartItems.length === 0) {
            window.openMessage('Your cart is empty. Add some products first!', 'error');
            return;
        }

        // Populate checkout modal
        let subtotal = 0;
        checkoutItemsList.innerHTML = currentCartItems.map(item => {
            subtotal += item.price * item.quantity;
            return `
                <li class="py-2 flex justify-between items-center">
                    <span>${item.name} x ${item.quantity}</span>
                    <span>₱${(item.price * item.quantity).toFixed(2)}</span>
                </li>
            `;
        }).join('');
        checkoutTotalSpan.textContent = `₱${subtotal.toFixed(2)}`;
        placeOrderButton.textContent = `Place Order (${currentCartItems.length} item${currentCartItems.length !== 1 ? 's' : ''}) ₱${subtotal.toFixed(2)}`;
        placeOrderButton.disabled = true; // Disable until payment method is selected

        // Reset payment method selection and roblox username field
        paymentMethodRadios.forEach(radio => radio.checked = false);
        robloxUsernameGroup.classList.add('hidden');
        robloxUsernameInput.value = '';

        window.openModal('checkout-modal');
    }

    /**
     * Handles the selection of a payment method in the checkout modal.
     */
    function handlePaymentMethodChange() {
        const selectedMethod = document.querySelector('#checkout-modal input[name="paymentMethod"]:checked')?.value || '';
        if (selectedMethod === 'Gcash') {
            robloxUsernameGroup.classList.remove('hidden');
            robloxUsernameInput.setAttribute('required', 'required');
        } else {
            robloxUsernameGroup.classList.add('hidden');
            robloxUsernameInput.removeAttribute('required');
        }

        // Enable place order button if a payment method is selected and roblox username is filled for Gcash
        placeOrderButton.disabled = !selectedMethod || (selectedMethod === 'Gcash' && !robloxUsernameInput.value);
    }

    /**
     * Handles the final "Place Order" button click in the checkout modal.
     */
    async function handlePlaceOrder() {
        const selectedPaymentMethod = document.querySelector('#checkout-modal input[name="paymentMethod"]:checked')?.value;
        const robloxUser = robloxUsernameInput.value;

        if (!selectedPaymentMethod) {
            window.openMessage('Please select a payment method.', 'error');
            return;
        }
        if (selectedPaymentMethod === 'Gcash' && !robloxUser) {
            window.openMessage('Please enter your Roblox Username for GCash payments.', 'error');
            return;
        }

        // Show payment instruction modal
        let imageUrl = '';
        let instructions = '';
        if (selectedPaymentMethod === 'Gcash') {
            imageUrl = '/images/Gcash.png';
            instructions = 'Scan the QR code or send to the number shown. After payment, click "Confirm Payment" and contact the seller with a screenshot of your receipt via Messenger/Discord.';
        } else if (selectedPaymentMethod === 'Maya') {
            imageUrl = '/images/Maya.png';
            instructions = 'Scan the QR code or send to the number shown. After payment, click "Confirm Payment" and contact the seller with a screenshot of your receipt via Messenger/Discord.';
        } else if (selectedPaymentMethod === 'Paypal') {
            imageUrl = '/images/Paypal.png';
            instructions = 'Follow the instructions to pay via PayPal. After payment, click "Confirm Payment" and contact the seller with a screenshot of your receipt via Messenger/Discord.';
        }

        paymentInstructionsMessage.textContent = instructions;
        currentPaymentImage.src = imageUrl;
        window.openModal('payment-image-modal');
        window.closeModal('checkout-modal'); // Close checkout modal
    }

    /**
     * Confirms the order after payment instructions are displayed.
     */
    async function confirmOrderAfterPaymentDisplay() {
        if (!window.db || !window.userId || !window.currentUser) {
            window.openMessage("Authentication error. Please log in again.", 'error');
            return;
        }

        window.closeModal('payment-image-modal'); // Close payment image modal

        const selectedPaymentMethod = document.querySelector('#checkout-modal input[name="paymentMethod"]:checked')?.value;
        const robloxUser = robloxUsernameInput.value;
        const totalAmount = parseFloat(checkoutTotalSpan.textContent.replace('₱', ''));

        try {
            // 1. Create a new order document in public orders collection
            const ordersCollectionRef = window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/orders`);
            const newOrderRef = await window.addDoc(ordersCollectionRef, {
                userId: window.userId,
                userEmail: window.currentUser.email,
                items: currentCartItems.map(item => ({
                    productId: item.productId, // Use original product ID from item
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    imageUrl: item.imageUrl,
                })),
                totalAmount: totalAmount,
                paymentMethod: selectedPaymentMethod,
                robloxUsername: robloxUser,
                status: 'In Process', // Initial status
                orderDate: window.serverTimestamp(),
            });

            // 2. Update product stock in Firestore
            for (const item of currentCartItems) {
                const productRef = window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`, item.productId);
                const productSnap = await window.getDoc(productRef);
                if (productSnap.exists()) {
                    const currentStock = productSnap.data().stock;
                    const updatedStock = currentStock - item.quantity;
                    await window.updateDoc(productRef, { stock: updatedStock >= 0 ? updatedStock : 0 });
                }
            }

            // 3. Clear the user's cart in Firestore
            const cartItemsSnapshot = await window.getDocs(window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/users/${window.userId}/cart`));
            for (const cartDoc of cartItemsSnapshot.docs) {
                await window.deleteDoc(cartDoc.ref);
            }
            // `onSnapshot` listener for cart will automatically update `currentCartItems` locally

            window.openMessage(`Order placed successfully! Order ID: ${newOrderRef.id}. Please remember to send your receipt screenshot to the seller.`, 'success');
            document.dispatchEvent(new CustomEvent('navigateTo', { detail: 'my-orders' })); // Redirect to my orders page

        } catch (error) {
            console.error("Error placing order:", error);
            window.openMessage(`Failed to place order: ${error.message}`, 'error');
        }
    }


    // --- My Orders Page Rendering ---

    /**
     * Renders the user's orders page.
     */
    function renderMyOrdersPage() {
        mainContent.innerHTML = `
            <div class="container mx-auto p-6">
                <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">My Orders</h2>
                <div id="my-orders-list-area" class="bg-white rounded-xl shadow-lg p-6">
                    <!-- Orders table or empty message will be injected here -->
                </div>
            </div>
        `;
        // Listen for orders and update display
        setupMyOrdersListener();
    }

    /**
     * Updates the display of orders in the "My Orders" page.
     * @param {Array<object>} ordersData - Array of order objects.
     */
    function updateMyOrdersDisplay(ordersData) {
        const myOrdersListArea = document.getElementById('my-orders-list-area');
        if (!myOrdersListArea) return;

        if (ordersData.length === 0) {
            myOrdersListArea.innerHTML = `
                <div class="text-center py-10">
                    <p class="text-xl text-gray-600 mb-4">You haven't placed any orders yet.</p>
                    <button id="start-shopping-my-orders" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300">
                        Start Shopping
                    </button>
                </div>
            `;
            document.getElementById('start-shopping-my-orders').addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('navigateTo', { detail: 'products' }));
            });
            return;
        }

        myOrdersListArea.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" class="relative px-6 py-3"><span class="sr-only">View</span></th>
                        </tr>
                    </thead>
                    <tbody id="my-orders-table-body" class="bg-white divide-y divide-gray-200">
                        ${ordersData.map(order => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate">${order.id}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.orderDate}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱${order.totalAmount.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="status-badge ${
                                        order.status === 'In Process' ? 'status-in-process' :
                                        order.status === 'Delivered' ? 'status-delivered' :
                                        'status-rejected'
                                    }">
                                        ${order.status}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button data-order-id="${order.id}" class="view-my-order-details-btn text-blue-600 hover:text-blue-900">
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        myOrdersListArea.querySelectorAll('.view-my-order-details-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.target.dataset.orderId;
                const orderToView = ordersData.find(o => o.id === orderId);
                if (orderToView) {
                    viewMyOrderDetails(orderToView);
                }
            });
        });
    }

    /**
     * Displays details for a specific order in a modal for the customer.
     * @param {object} order - The order object.
     */
    function viewMyOrderDetails(order) {
        const modalTitle = document.getElementById('order-detail-title');
        const orderDetailsInfo = document.getElementById('order-details-info');
        const orderDetailItemsList = document.getElementById('order-detail-items-list');
        const orderDetailTotal = document.getElementById('order-detail-total');
        const adminOrderStatusUpdate = document.getElementById('admin-order-status-update');

        modalTitle.textContent = `Order ID: ${order.id}`;
        orderDetailsInfo.innerHTML = `
            <p><strong>Date:</strong> ${order.orderDate}</p>
            <p><strong>Status:</strong> <span class="status-badge ${
                order.status === 'In Process' ? 'status-in-process' :
                order.status === 'Delivered' ? 'status-delivered' :
                'status-rejected'
            }">${order.status}</span></p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            ${order.robloxUsername ? `<p><strong>Roblox Username:</strong> ${order.robloxUsername}</p>` : ''}
        `;

        orderDetailItemsList.innerHTML = order.items.map(item => `
            <li class="text-gray-700">
                ${item.name} (x${item.quantity}) - ₱${item.price.toFixed(2)} each
            </li>
        `).join('');

        orderDetailTotal.innerHTML = `Total Amount: ₱${order.totalAmount.toFixed(2)}`;

        adminOrderStatusUpdate.classList.add('hidden'); // Hide admin specific status update buttons

        window.openModal('order-detail-modal');
    }

    // --- Firebase Data Listeners (Customer Specific) ---

    let unsubscribeProducts = null;
    /**
     * Sets up a real-time listener for public product data.
     */
    function setupProductsListener() {
        if (unsubscribeProducts) unsubscribeProducts(); // Clean up previous listener
        if (!window.db || window.firebaseLoading) return;

        const productsCollectionRef = window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`);
        unsubscribeProducts = window.onSnapshot(
            productsCollectionRef,
            (snapshot) => {
                allProducts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                // Re-render products if on product page
                if (mainContent.innerHTML.includes('product-grid')) { // Simple check if product page is active
                     filterAndRenderProducts();
                }
            },
            (err) => {
                console.error("Error fetching products:", err);
                window.openMessage("Failed to load products. Please try again later.", 'error');
            }
        );
    }

    let unsubscribeCart = null;
    /**
     * Sets up a real-time listener for the user's private cart data.
     */
    function setupCartListener() {
        if (unsubscribeCart) unsubscribeCart(); // Clean up previous listener
        if (!window.db || !window.userId || window.firebaseLoading) return;

        const cartCollectionRef = window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/users/${window.userId}/cart`);
        unsubscribeCart = window.onSnapshot(
            cartCollectionRef,
            (snapshot) => {
                currentCartItems = snapshot.docs.map(doc => ({
                    id: doc.id,
                    productId: doc.data().productId, // Store original product ID
                    name: doc.data().name,
                    price: doc.data().price,
                    imageUrl: doc.data().imageUrl,
                    quantity: doc.data().quantity,
                }));
                // Update cart display if on cart page or for header count
                if (mainContent.innerHTML.includes('cart-items-table-body')) { // Simple check if cart page is active
                    updateCartDisplay();
                } else {
                    // Just update header cart count
                    cartItemCountSpan.textContent = currentCartItems.reduce((count, item) => count + item.quantity, 0);
                    cartItemCountSpan.classList.toggle('hidden', currentCartItems.length === 0);
                }
            },
            (err) => {
                console.error("Error fetching cart:", err);
                window.openMessage("Failed to load cart. Please try again.", 'error');
            }
        );
    }

    let unsubscribeMyOrders = null;
    /**
     * Sets up a real-time listener for the current user's orders.
     */
    function setupMyOrdersListener() {
        if (unsubscribeMyOrders) unsubscribeMyOrders(); // Clean up previous listener
        if (!window.db || !window.userId || window.firebaseLoading) {
             console.log("Firebase not ready or userId missing for my orders listener.");
             return;
        }

        const ordersCollectionRef = window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/orders`);
        const q = window.query(ordersCollectionRef, window.where("userId", "==", window.userId));

        unsubscribeMyOrders = window.onSnapshot(
            q,
            (snapshot) => {
                const userOrders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    orderDate: doc.data().orderDate?.toDate().toLocaleDateString() || 'N/A',
                }));
                userOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
                // Only update display if My Orders page is active
                if (mainContent.innerHTML.includes('my-orders-list-area')) {
                    updateMyOrdersDisplay(userOrders);
                }
            },
            (err) => {
                console.error("Error fetching user orders:", err);
                window.openMessage("Failed to load your orders. Please try again.", 'error');
            }
        );
    }


    // --- Event Listeners and Initial Setup ---

    // Listen for custom event that signals Firebase is ready
    document.addEventListener('firebaseAuthReady', () => {
        updateAuthUI(); // Update auth buttons immediately
        setupProductsListener(); // Always listen for products
        setupCartListener(); // Listen for cart when user is available
        setupMyOrdersListener(); // Listen for my orders when user is available

        // Render initial page (products) once Firebase is ready
        renderProductListPage();
    });

    // Listen for changes in authentication state to update UI and listeners
    // This is handled by onAuthStateChanged in index.html, which dispatches firebaseAuthReady

    // --- Auth Modal Event Listeners ---
    authForm.addEventListener('submit', handleAuthFormSubmit);
    authToggleButton.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        updateLoginRegisterModalUI();
    });
    // Listen for changes in email/password fields to clear error message
    authEmailInput.addEventListener('input', () => authErrorMessage.classList.add('hidden'));
    authPasswordInput.addEventListener('input', () => authErrorMessage.classList.add('hidden'));
    authConfirmPasswordInput.addEventListener('input', () => authErrorMessage.classList.add('hidden'));


    // --- Checkout Modal Event Listeners ---
    paymentMethodRadios.forEach(radio => {
        radio.addEventListener('change', handlePaymentMethodChange);
    });
    robloxUsernameInput.addEventListener('input', handlePaymentMethodChange); // Re-evaluate button enable on input
    placeOrderButton.addEventListener('click', handlePlaceOrder);
    confirmPaymentOrderButton.addEventListener('click', confirmOrderAfterPaymentDisplay);


    // --- Navigation Listener (from Header/Logo) ---
    document.addEventListener('navigateTo', (event) => {
        const page = event.detail;
        mainContent.innerHTML = ''; // Clear current content
        switch (page) {
            case 'products':
                renderProductListPage();
                break;
            case 'cart':
                renderCartPage();
                break;
            case 'my-orders':
                renderMyOrdersPage();
                break;
            // Admin Panel navigation is handled by admin.js
            default:
                renderProductListPage();
        }
        // Re-setup listeners relevant to the current page if they depend on DOM elements
        if (page === 'products') setupProductsListener();
        if (page === 'cart') setupCartListener();
        if (page === 'my-orders') setupMyOrdersListener();
        updateAuthUI(); // Always update auth UI on navigation
    });

    // Initial check for auth UI in case script loads after firebaseAuthReady fired
    if (!window.firebaseLoading) {
        updateAuthUI();
        // Render default page if firebaseAuthReady already fired
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            renderProductListPage();
            setupProductsListener();
            setupCartListener();
            setupMyOrdersListener();
        }
    }
});
