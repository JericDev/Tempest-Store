// admin.js
// This file contains all logic and DOM manipulations specific to the admin panel.

// Global variables for admin-specific data and listeners
let allOrders = []; // Global array to store all orders for admin view
let unsubscribeAllOrders = null; // Unsubscribe function for allOrders listener
let dbInstance = null; // Firestore instance passed from script.js
let authInstance = null; // Auth instance passed from script.js
let adminUserId = null; // Admin user ID passed from script.js
let isAdminUser = false; // Is Admin flag passed from script.js

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
const productImageInput = document.getElementById("product-image"); 
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


// --- Firestore Collection Paths (These are defined locally in admin.js for clarity) ---
const APP_ID = 'tempest-store-app'; // Ensure this matches APP_ID in script.js
const PRODUCTS_COLLECTION_PATH = `artifacts/${APP_ID}/products`; 
const ALL_ORDERS_COLLECTION_PATH = `artifacts/${APP_ID}/allOrders`; 
const USER_ORDERS_COLLECTION_PATH = (userId) => `artifacts/${APP_ID}/users/${userId}/orders`; // Needed for updating user-specific order status


// --- Admin Panel Functions ---
function initAdminPanel(db, auth, userId, adminFlag) {
    dbInstance = db;
    authInstance = auth;
    adminUserId = userId;
    isAdminUser = adminFlag;

    // Attach event listener for the admin panel button
    // This button is controlled by script.js's onAuthStateChanged for visibility
    const adminPanelButton = document.getElementById("admin-panel-button");
    if (adminPanelButton) {
        adminPanelButton.onclick = () => { // Use onclick to ensure it's attached only once, or remove previous listener first
             if (!isAdminUser) {
                alert("You are not authorized to access the Admin Panel.");
                return;
            }
            adminPanelModal.classList.add('show');
            // Default to product management tab when opening
            showAdminTab('products');
        };
    }

    closeAdminPanelModalBtn.addEventListener('click', () => {
        adminPanelModal.classList.remove('show');
    });

    adminPanelModal.addEventListener('click', (event) => {
        if (event.target === adminPanelModal) {
            adminPanelModal.classList.remove('show');
        }
    });

    adminTabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            showAdminTab(tab);
        });
    });

    saveProductBtn.addEventListener('click', async () => { 
        const productId = productIdInput.value;
        const isNew = productNewCheckbox.checked;
        const isSale = productSaleCheckbox.checked;
        let salePrice = null;
        let productImage = productImageInput.value.trim();

        if (isSale && productSalePriceInput.value.trim() !== '') {
            salePrice = `₱${parseFloat(productSalePriceInput.value).toFixed(2)}`;
        } else {
            salePrice = null; 
        }

        const newProduct = {
            name: productNameInput.value.trim(),
            category: productCategorySelect.value,
            price: `₱${parseFloat(productPriceInput.value).toFixed(2)}`, 
            salePrice: salePrice, 
            stock: parseInt(productStockInput.value),
            image: productImage, 
            new: isNew, 
            sale: isSale 
        };

        if (!newProduct.name || !newProduct.image || isNaN(newProduct.stock) || isNaN(parseFloat(newProduct.price.replace('₱', '')))) {
            alert("Please fill in all product fields correctly, including an image filename (e.g., product.png).");
            return;
        }
        if (isSale && (salePrice === null || isNaN(parseFloat(salePrice.replace('₱', ''))))) {
            alert("Please enter a valid Sale Price if the product is On Sale.");
            return;
        }

        if (productId) {
            newProduct.id = productId; 
        }
        saveProductToFirestore(newProduct); 
    });

    cancelEditProductBtn.addEventListener('click', resetProductForm);

    adminBackToOrderListBtn.addEventListener('click', () => {
        adminOrdersList.parentElement.style.display = 'table'; 
        adminOrderDetailsView.style.display = 'none'; 
        currentEditingOrderId = null; 
    });

    updateOrderStatusBtn.addEventListener('click', async () => {
        if (!currentEditingOrderId) {
            alert("No order selected for status update.");
            return;
        }

        const newStatus = orderStatusSelect.value;
        try {
            const orderRef = doc(dbInstance, ALL_ORDERS_COLLECTION_PATH, currentEditingOrderId);
            await updateDoc(orderRef, { status: newStatus });

            const orderToUpdate = allOrders.find(o => o.id === currentEditingOrderId);
            if (orderToUpdate && orderToUpdate.userId) {
                const userOrderRef = doc(dbInstance, USER_ORDERS_COLLECTION_PATH(orderToUpdate.userId), currentEditingOrderId);
                await updateDoc(userOrderRef, { status: newStatus });
            }

            alert(`Order ${currentEditingOrderId.substring(0, 8)}... status updated to ${newStatus}.`);
            adminBackToOrderListBtn.click();
        } catch (e) {
            console.error("Error updating order status:", e);
            alert("Error updating order status: " + e.message);
        }
    });

    // Initialize admin listeners if an admin is already logged in
    setupAllOrdersListener();
}

// Cleanup function for admin panel when user logs out
function cleanupAdminPanel() {
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
        unsubscribeAllOrders = null;
    }
    // Any other cleanup for admin UI goes here
    adminPanelModal.classList.remove('show'); // Ensure admin modal is closed
    // Re-set onclick to null to avoid multiple attachments on re-login
    const adminPanelButton = document.getElementById("admin-panel-button");
    if (adminPanelButton) {
        adminPanelButton.onclick = null; 
    }
}


// Saves a product (new or existing) to Firestore.
async function saveProductToFirestore(productData) {
    try {
        if (productData.id) { 
            if (!confirm("Are you sure you want to save changes to this product?")) {
                return; 
            }
            const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productData.id);
            await updateDoc(productRef, productData);
            console.log("Product updated:", productData.id);
        } else { 
            const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
            await addDoc(productsColRef, productData);
            console.log("Product added:", productData.name);
        }
        resetProductForm(); 
        alert("Product saved successfully!");
    } catch (e) {
        console.error("Error saving product:", e);
        alert("Error saving product: " + e.message);
    }
}

// Deletes a product from Firestore.
async function deleteProductFromFirestore(productId) {
    if (confirm("Are you sure you want to delete this product?")) { 
        try {
            const productRef = doc(dbInstance, PRODUCTS_COLLECTION_PATH, productId);
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
// Note: This relies on `allProducts` being updated by the listener in `script.js`
// or a specific admin-only products listener could be added here if needed for independent data.
function renderAdminProducts() {
    adminProductsList.innerHTML = ''; 
    // Access allProducts from the main scope or pass it. For now, assume it's globally available 
    // or setup a separate listener in admin.js if truly decoupled.
    // To ensure admin.js has the latest products, we will fetch them again for the admin view.
    const productsColRef = collection(dbInstance, PRODUCTS_COLLECTION_PATH);
    getDocs(productsColRef).then((snapshot) => {
        const fetchedProducts = [];
        snapshot.forEach(doc => {
            fetchedProducts.push({ id: doc.id, ...doc.data() });
        });

        if (fetchedProducts.length === 0) {
            adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">No products found.</td></tr>';
            return;
        }

        fetchedProducts.forEach(product => {
            const row = document.createElement('tr');
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

        adminProductsList.querySelectorAll('.edit').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const productToEdit = fetchedProducts.find(p => p.id === productId); // Find from fetched data
                if (productToEdit) {
                    editProduct(productToEdit); 
                }
            });
        });

        adminProductsList.querySelectorAll('.delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                deleteProductFromFirestore(productId); 
            });
        });
    }).catch(error => {
        console.error("Error rendering admin products:", error);
        adminProductsList.innerHTML = '<tr><td colspan="7" class="empty-message">Error loading products.</td></tr>';
    });
}


function editProduct(product) {
    productFormTitle.textContent = "Edit Product";
    productIdInput.value = product.id; 
    productNameInput.value = product.name;
    productCategorySelect.value = product.category;
    productPriceInput.value = parseFloat(product.price.replace('₱', '')); 
    productSalePriceInput.value = product.salePrice ? parseFloat(product.salePrice.replace('₱', '')) : ''; 
    productStockInput.value = product.stock;
    productImageInput.value = product.image; 
    productNewCheckbox.checked = product.new || false;
    productSaleCheckbox.checked = product.sale || false;
    saveProductBtn.textContent = "Save Changes"; 
    cancelEditProductBtn.style.display = "inline-block"; 
}

function resetProductForm() {
    productFormTitle.textContent = "Add New Product";
    productIdInput.value = ''; 
    productNameInput.value = '';
    productCategorySelect.value = 'pets';
    productPriceInput.value = '';
    productSalePriceInput.value = ''; 
    productStockInput.value = '';
    productImageInput.value = ''; 
    productNewCheckbox.checked = false;
    productSaleCheckbox.checked = false;
    saveProductBtn.textContent = "Add Product"; 
    cancelEditProductBtn.style.display = "none"; 
}

function showAdminTab(tabName) {
    adminTabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    adminProductManagement.style.display = 'none';
    adminOrderManagement.style.display = 'none';

    if (tabName === 'products') {
        adminProductManagement.style.display = 'block';
        resetProductForm(); 
        renderAdminProducts(); 
    } else if (tabName === 'orders') {
        adminOrderManagement.style.display = 'block';
        adminOrderDetailsView.style.display = 'none'; 
        renderAdminOrders(); 
    }
}

// Sets up a real-time listener for all orders in Firestore (for admin view).
function setupAllOrdersListener() {
    // Unsubscribe from previous listener if exists
    if (unsubscribeAllOrders) {
        unsubscribeAllOrders();
    }
    const allOrdersColRef = collection(dbInstance, ALL_ORDERS_COLLECTION_PATH);
    const q = query(allOrdersColRef, orderBy("orderDate", "desc"));
    unsubscribeAllOrders = onSnapshot(q, (snapshot) => { 
        const fetchedOrders = [];
        snapshot.forEach(doc => {
            fetchedOrders.push({ id: doc.id, ...doc.data() });
        });
        allOrders = fetchedOrders; // Update the local admin allOrders array
        renderAdminOrders(); // Re-render the admin orders table (if admin panel is open)
    }, (error) => {
        console.error("Error listening to all orders (admin):", error);
    });
}

function renderAdminOrders() {
    adminOrdersList.innerHTML = ''; 
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

    adminOrdersList.querySelectorAll('.view').forEach(button => {
        button.addEventListener('click', (e) => {
            const orderId = e.target.dataset.id;
            const selectedOrder = allOrders.find(order => order.id === orderId);
            if (selectedOrder) {
                showAdminOrderDetails(selectedOrder); 
            }
        });
    });
}

function showAdminOrderDetails(order) {
    currentEditingOrderId = order.id; 
    adminOrdersList.parentElement.style.display = 'none'; 
    adminOrderDetailsView.style.display = 'block'; 

    adminDetailOrderId.textContent = order.id;
    adminDetailUserId.textContent = order.userId || 'N/A';
    adminDetailRobloxUsername.textContent = order.robloxUsername || 'N/A';
    adminDetailOrderDate.textContent = new Date(order.orderDate).toLocaleString();
    adminDetailOrderPrice.textContent = `₱${order.total.toFixed(2)}`;
    adminDetailPaymentMethod.textContent = order.paymentMethod;
    adminDetailOrderStatus.textContent = order.status;
    adminDetailOrderStatus.className = `status-info order-item-status status-${order.status.toLowerCase().replace(/\s/g, '-')}`;

    orderStatusSelect.value = order.status;

    adminDetailItemsList.innerHTML = ''; 
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'admin-order-detail-item';
            const imageUrl = `images/${item.image}`; 
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

// Export the initialization function for script.js to call
export { initAdminPanel, cleanupAdminPanel };
