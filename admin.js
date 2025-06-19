// Import necessary Firebase functions
import { collection, doc, setDoc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// Global variables for admin functionality
let dbInstance;
let authInstance;
let currentAdminUid;
let isAdminUser;

// Firestore Collection Paths (copied from script.js to ensure consistency)
const APP_ID = 'tempest-store-app';
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`;
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`;
const STORE_SETTINGS_DOC_PATH = `artifacts/${APP_ID}/storeSettings/config`; // Centralized settings document

// DOM elements (declared globally within this module for easier access)
let adminPanelModal;
let adminTabButtons;
let adminTabContents;
let adminProductManagement;
let adminOrderManagement;
let adminStoreSettings; // New tab content for store settings
let adminSellerStatusDisplay; // Element to show status in admin panel
let toggleSellerStatusBtn; // Button to toggle status
let headerSellerStatusText; // Reference to the seller status text in the main header (passed from script.js)

// Unsubscribe functions for real-time listeners
let unsubscribeAllOrders = null;
let unsubscribeStoreSettings = null; // New unsubscribe for store settings listener

// Variables for product management
let currentEditProductId = null;
let allOrders = []; // To store all orders for admin view

// Exported function to initialize the admin panel
export function initAdminPanel(db, auth, uid, adminFlag, headerSellerStatusTextElement) {
    dbInstance = db;
    authInstance = auth;
    currentAdminUid = uid;
    isAdminUser = adminFlag;
    headerSellerStatusText = headerSellerStatusTextElement; // Assign the passed element

    // Get DOM elements (ensure these exist in index.html)
    adminPanelModal = document.getElementById('admin-panel-modal');
    adminTabButtons = document.querySelectorAll('.admin-tabs .admin-tab-btn');
    adminTabContents = document.querySelectorAll('.admin-tab-content');
    adminProductManagement = document.getElementById('admin-product-management');
    adminOrderManagement = document.getElementById('admin-order-management');
    adminStoreSettings = document.getElementById('admin-store-settings'); // Get new settings div

    // Admin Product Management DOM elements
    const productFormContainer = document.getElementById('product-form-container');
    const productFormTitle = document.getElementById('product-form-title');
    const productIdInput = document.getElementById('product-id-input');
    const productNameInput = document.getElementById('product-name');
    const productCategorySelect = document.getElementById('product-category');
    const productPriceInput = document.getElementById('product-price');
    const productSalePriceInput = document.getElementById('product-sale-price');
    const productStockInput = document.getElementById('product-stock');
    const productImageInput = document.getElementById('product-image');
    const productNewCheckbox = document.getElementById('product-new');
    const productSaleCheckbox = document.getElementById('product-sale');
    const saveProductBtn = document.getElementById('save-product-btn');
    const cancelEditProductBtn = document.getElementById('cancel-edit-product');
    const adminProductsList = document.getElementById('admin-products-list');

    // Admin Order Management DOM elements
    const adminOrdersList = document.getElementById('admin-orders-list');
    const adminOrderDetailsView = document.getElementById('admin-order-details-view');
    const adminDetailOrderId = document.getElementById('admin-detail-order-id');
    const adminDetailUserId = document.getElementById('admin-detail-user-id');
    const adminDetailRobloxUsername = document.getElementById('admin-detail-roblox-username');
    const adminDetailOrderDate = document.getElementById('admin-detail-order-date');
    const adminDetailOrderPrice = document.getElementById('admin-detail-order-price');
    const adminDetailPaymentMethod = document.getElementById('admin-detail-payment-method');
    const adminDetailOrderStatus = document.getElementById('admin-detail-order-status');
    const adminDetailItemsList = document.getElementById('admin-detail-items-list');
    const orderStatusSelect = document.getElementById('order-status-select');
    const updateOrderStatusBtn = document.getElementById('update-order-status-btn');
    const adminBackToOrderListBtn = document.getElementById('admin-back-to-order-list');

    // Store Settings DOM elements
    adminSellerStatusDisplay = document.getElementById('admin-seller-status-display');
    toggleSellerStatusBtn = document.getElementById('toggle-seller-status-btn');


    // Event listeners for admin tab switching
    adminTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            adminTabButtons.forEach(btn => btn.classList.remove('active'));
            adminTabContents.forEach(content => content.style.display = 'none');

            button.classList.add('active');
            if (tab === 'products') {
                adminProductManagement.style.display = 'block';
                renderAdminProducts(); // Re-render products when tab is active
                // Unsubscribe from other tabs if switching
                if (unsubscribeAllOrders) unsubscribeAllOrders();
                if (unsubscribeStoreSettings) unsubscribeStoreSettings();
            } else if (tab === 'orders') {
                adminOrderManagement.style.display = 'block';
                setupAllOrdersListener(); // Start listening to orders when tab is active
                // Unsubscribe from other tabs if switching
                // No need to unsubscribe from products listener as it's global in script.js
                if (unsubscribeStoreSettings) unsubscribeStoreSettings();
            } else if (tab === 'settings') { // Handle new settings tab
                adminStoreSettings.style.display = 'block';
                setupStoreSettingsListener(); // Start listening to store settings
                // Unsubscribe from other tabs if switching
                if (unsubscribeAllOrders) unsubscribeAllOrders();
            }
        });
    });

    // --- Product Management Functions (Admin) ---

    // Sets up a real-time listener for products collection to render in admin panel
    function setupAdminProductsListener() {
        const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
        // Products are loaded globally in script.js, so we just use allProducts.
        // This function is mainly for rendering the admin specific table.
        renderAdminProducts();
    }

    // Renders the list of products in the admin panel table
    function renderAdminProducts() {
        adminProductsList.innerHTML = '';
        if (window.allProducts.length === 0) { // Using window.allProducts as it's loaded by script.js
            adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">No products found.</td></tr>';
            return;
        }

        window.allProducts.forEach(product => {
            const row = document.createElement('tr');
            const displayPrice = product.sale && product.salePrice ?
                                 `<span style="text-decoration: line-through; color: #888;">${product.price}</span> ${product.salePrice}` :
                                 product.price;
            const imageUrl = `images/${product.image}`;
            row.innerHTML = `
                <td><img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/50x50/f0f0f0/888?text=N/A';" style="width:50px; height:50px; border-radius:5px;"/></td>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>${displayPrice}</td>
                <td>${product.stock}</td>
                <td>${product.new ? 'New' : ''} ${product.sale ? 'Sale' : ''}</td>
                <td class="admin-product-actions">
                    <button class="edit" data-id="${product.id}">Edit</button>
                    <button class="delete" data-id="${product.id}">Delete</button>
                </td>
            `;
            adminProductsList.appendChild(row);
        });

        // Add event listeners for edit and delete buttons
        adminProductsList.querySelectorAll('.edit').forEach(button => {
            button.addEventListener('click', (e) => editProduct(e.target.dataset.id));
        });
        adminProductsList.querySelectorAll('.delete').forEach(button => {
            button.addEventListener('click', (e) => deleteProduct(e.target.dataset.id));
        });
    }

    // Handles adding or updating a product in Firestore
    saveProductBtn.addEventListener('click', async () => {
        const id = productIdInput.value;
        const name = productNameInput.value.trim();
        const category = productCategorySelect.value;
        const price = parseFloat(productPriceInput.value);
        const salePrice = parseFloat(productSalePriceInput.value) || null;
        const stock = parseInt(productStockInput.value);
        const image = productImageInput.value.trim();
        const isNew = productNewCheckbox.checked;
        const onSale = productSaleCheckbox.checked;

        if (!name || isNaN(price) || isNaN(stock) || !category) {
            alert("Please fill all required product fields.");
            return;
        }
        if (onSale && isNaN(salePrice)) {
            alert("Please enter a valid Sale Price if 'On Sale' is checked.");
            return;
        }

        saveProductBtn.disabled = true;

        const productData = {
            name,
            category,
            price: `₱${price.toFixed(2)}`,
            stock,
            image,
            new: isNew,
            sale: onSale,
            salePrice: onSale ? `₱${salePrice.toFixed(2)}` : null,
        };

        try {
            if (id) {
                // Update existing product
                const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, id);
                await updateDoc(productRef, productData);
                alert('Product updated successfully!');
            } else {
                // Add new product
                const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
                await addDoc(productsColRef, productData);
                alert('Product added successfully!');
            }
            clearProductForm();
        } catch (e) {
            console.error("Error saving product: ", e);
            alert("Error saving product: " + e.message);
        } finally {
            saveProductBtn.disabled = false;
        }
    });

    // Populates the form for editing an existing product
    function editProduct(productId) {
        const product = window.allProducts.find(p => p.id === productId); // Use window.allProducts
        if (product) {
            currentEditProductId = productId;
            productIdInput.value = product.id;
            productNameInput.value = product.name;
            productCategorySelect.value = product.category;
            productPriceInput.value = parseFloat(product.price.replace('₱', ''));
            productSalePriceInput.value = product.salePrice ? parseFloat(product.salePrice.replace('₱', '')) : '';
            productStockInput.value = product.stock;
            productImageInput.value = product.image;
            productNewCheckbox.checked = product.new || false;
            productSaleCheckbox.checked = product.sale || false;

            productFormTitle.textContent = 'Edit Product';
            saveProductBtn.textContent = 'Update Product';
            cancelEditProductBtn.style.display = 'inline-block';
        }
    }

    // Deletes a product from Firestore
    async function deleteProduct(productId) {
        if (confirm("Are you sure you want to delete this product?")) {
            try {
                const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productId);
                await deleteDoc(productRef);
                alert("Product deleted successfully!");
            } catch (e) {
                console.error("Error deleting product: ", e);
                alert("Error deleting product: " + e.message);
            }
        }
    }

    // Clears the product form
    function clearProductForm() {
        currentEditProductId = null;
        productIdInput.value = '';
        productNameInput.value = '';
        productCategorySelect.value = 'pets';
        productPriceInput.value = '';
        productSalePriceInput.value = '';
        productStockInput.value = '';
        productImageInput.value = '';
        productNewCheckbox.checked = false;
        productSaleCheckbox.checked = false;

        productFormTitle.textContent = 'Add New Product';
        saveProductBtn.textContent = 'Add Product';
        cancelEditProductBtn.style.display = 'none';
    }

    cancelEditProductBtn.addEventListener('click', clearProductForm);

    // --- Order Management Functions (Admin) ---

    // Sets up a real-time listener for all orders collection
    function setupAllOrdersListener() {
        if (unsubscribeAllOrders) {
            unsubscribeAllOrders(); // Unsubscribe from previous listener if exists
        }
        const allOrdersColRef = collection(dbInstance, ALL_ORDERS_COLLECTION_PATH);
        unsubscribeAllOrders = onSnapshot(allOrdersColRef, (snapshot) => {
            const fetchedOrders = [];
            snapshot.forEach(doc => {
                fetchedOrders.push({ id: doc.id, ...doc.data() });
            });
            allOrders = fetchedOrders;
            renderAdminOrders();
        }, (error) => {
            console.error("Error listening to all orders:", error);
        });
    }

    // Renders the list of all orders in the admin panel table
    function renderAdminOrders() {
        adminOrdersList.innerHTML = '';

        if (allOrders.length === 0) {
            adminOrdersList.innerHTML = '<tr><td colspan="6" class="empty-message">No orders found.</td></tr>';
            return;
        }

        allOrders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.id.substring(0, 8)}...</td>
                <td>${order.userId.substring(0, 8)}...</td>
                <td>${new Date(order.orderDate).toLocaleDateString()}</td>
                <td>₱${order.total.toFixed(2)}</td>
                <td><span class="order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}}">${order.status}</span></td>
                <td class="admin-order-actions">
                    <button class="view" data-id="${order.id}">View</button>
                </td>
            `;
            adminOrdersList.appendChild(row);
        });

        adminOrdersList.querySelectorAll('.view').forEach(button => {
            button.addEventListener('click', (e) => showAdminOrderDetails(e.target.dataset.id));
        });
    }

    // Displays full details of a selected order in the admin panel
    function showAdminOrderDetails(orderId) {
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            adminOrderManagement.style.display = 'none'; // Hide order list
            adminOrderDetailsView.style.display = 'block'; // Show order details

            adminDetailOrderId.textContent = order.id;
            adminDetailUserId.textContent = order.userId;
            adminDetailRobloxUsername.textContent = order.robloxUsername || 'N/A';
            adminDetailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
            adminDetailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
            adminDetailPaymentMethod.textContent = order.paymentMethod;
            adminDetailOrderStatus.textContent = order.status;
            adminDetailOrderStatus.className = `status-info order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;

            // Set current status in the select dropdown
            orderStatusSelect.value = order.status;

            adminDetailItemsList.innerHTML = '';
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'admin-order-detail-item';
                    itemDiv.innerHTML = `
                        <span class="admin-order-detail-item-name">${item.name}</span>
                        <span class="admin-order-detail-item-qty-price">Qty: ${item.quantity} - ${item.effectivePrice || item.price}</span>
                    `;
                    adminDetailItemsList.appendChild(itemDiv);
                });
            } else {
                adminDetailItemsList.innerHTML = '<p>No items found for this order.</p>';
            }

            // Set up listener for updating order status
            updateOrderStatusBtn.onclick = async () => {
                if (!isAdminUser) {
                    alert("You do not have permission to update order status.");
                    return;
                }
                const newStatus = orderStatusSelect.value;
                if (newStatus && newStatus !== order.status) {
                    updateOrderStatusBtn.disabled = true;
                    try {
                        // Update in both user's collection and allOrders collection
                        const userOrderRef = doc(dbInstance, `artifacts/${APP_ID}/users/${order.userId}/orders`, order.id);
                        const allOrderRef = doc(dbInstance, ALL_ORDERS_COLLECTION_PATH, order.id);

                        await updateDoc(userOrderRef, { status: newStatus });
                        await updateDoc(allOrderRef, { status: newStatus });

                        alert("Order status updated successfully!");
                        adminOrderDetailsView.style.display = 'none';
                        adminOrderManagement.style.display = 'block';
                        renderAdminOrders(); // Re-render to show updated status
                    } catch (e) {
                        console.error("Error updating order status:", e);
                        alert("Failed to update order status: " + e.message);
                    } finally {
                        updateOrderStatusBtn.disabled = false;
                    }
                } else {
                    alert("No new status selected or status is the same.");
                }
            };
        }
    }

    adminBackToOrderListBtn.addEventListener('click', () => {
        adminOrderManagement.style.display = 'block';
        adminOrderDetailsView.style.display = 'none';
        renderAdminOrders();
    });


    // --- Store Settings Functions (Admin) ---

    // Sets up a real-time listener for the store settings document.
    function setupStoreSettingsListener() {
        if (unsubscribeStoreSettings) {
            unsubscribeStoreSettings(); // Unsubscribe from previous listener if exists
        }
        const storeSettingsRef = doc(dbInstance, STORE_SETTINGS_DOC_PATH);
        unsubscribeStoreSettings = onSnapshot(storeSettingsRef, (docSnap) => {
            let isOnline = true; // Default status if document doesn't exist

            if (docSnap.exists()) {
                isOnline = docSnap.data().isOnline;
            } else {
                // If the document doesn't exist, create it with default online status
                setDoc(storeSettingsRef, { isOnline: true })
                    .then(() => console.log("Store settings document created with default online status."))
                    .catch(e => console.error("Error creating store settings:", e));
            }
            updateSellerStatusDisplay(isOnline);
        }, (error) => {
            console.error("Error listening to store settings:", error);
        });
    }

    // Updates the seller status display in both the admin panel and the main header.
    function updateSellerStatusDisplay(isOnline) {
        if (adminSellerStatusDisplay) {
            adminSellerStatusDisplay.textContent = isOnline ? 'Online' : 'Offline';
            adminSellerStatusDisplay.classList.toggle('offline', !isOnline); // Apply offline class for red text
            adminSellerStatusDisplay.classList.toggle('online', isOnline); // Ensure online class for green text
        }
        if (headerSellerStatusText) { // This element is from the main page header
            headerSellerStatusText.textContent = isOnline ? 'Online' : 'Offline';
            headerSellerStatusText.classList.toggle('offline', !isOnline); // Apply offline class for red text
            headerSellerStatusText.classList.toggle('online', isOnline); // Ensure online class for green text
        }
    }

    // Toggles the seller status in Firestore.
    toggleSellerStatusBtn.addEventListener('click', async () => {
        if (!isAdminUser) {
            alert("You do not have permission to change store settings.");
            return;
        }
        toggleSellerStatusBtn.disabled = true;
        try {
            const storeSettingsRef = doc(dbInstance, STORE_SETTINGS_DOC_PATH);
            const docSnap = await getDoc(storeSettingsRef);
            let currentStatus = true; // Default if doc doesn't exist
            if (docSnap.exists()) {
                currentStatus = docSnap.data().isOnline;
            }
            await updateDoc(storeSettingsRef, { isOnline: !currentStatus });
            console.log("Seller status toggled to:", !currentStatus);
        } catch (e) {
            console.error("Error toggling seller status:", e);
            alert("Failed to toggle seller status. Please try again.");
        } finally {
            toggleSellerStatusBtn.disabled = false;
        }
    });


    // Cleanup function to detach all listeners when admin panel is closed or user logs out.
    // This function is called by script.js when the admin panel is closed or user logs out.
    export function cleanupAdminPanel() {
        if (unsubscribeAllOrders) {
            unsubscribeAllOrders();
            unsubscribeAllOrders = null;
            console.log("Unsubscribed from allOrders listener.");
        }
        if (unsubscribeStoreSettings) {
            unsubscribeStoreSettings();
            unsubscribeStoreSettings = null;
            console.log("Unsubscribed from storeSettings listener.");
        }
        // Reset admin panel display
        if (adminProductManagement) adminProductManagement.style.display = 'none';
        if (adminOrderManagement) adminOrderManagement.style.display = 'none';
        if (adminStoreSettings) adminStoreSettings.style.display = 'none'; // Hide the settings tab content

        // Reset active tab button
        adminTabButtons.forEach(btn => btn.classList.remove('active'));
        // Optionally activate default tab (e.g., products)
        const productsTabBtn = document.querySelector('.admin-tab-btn[data-tab="products"]');
        if (productsTabBtn) {
            productsTabBtn.classList.add('active');
        }
    }

    // When admin panel is opened for the first time, ensure the correct tab is active and its listener started.
    // The default active tab is 'products', so its listener should be started automatically.
    // This part should ideally be triggered when the admin panel modal is *shown*.
    // For now, if the modal is already shown (e.g., on initial load if admin is logged in), simulate click.
    if (adminPanelModal.classList.contains('show')) {
        document.querySelector('.admin-tab-btn[data-tab="products"]').click();
    }
}
