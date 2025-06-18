// admin.js - Admin Panel Logic
// This script assumes Firebase has been initialized and
// global variables like window.db, window.auth, window.currentUser,
// window.isAdmin, window.firebaseLoading, window.openMessage,
// window.openModal, window.closeModal, window.USER_FIREBASE_CONFIG,
// and window.ADMIN_UID are available from index.html.

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements for the Admin Panel
    const mainContent = document.getElementById('main-content');
    let adminPanelContainer = null; // Will be created dynamically

    // Product Management Form Elements
    let productForm = {
        id: null, // For editing existing products
        name: '',
        category: '',
        price: '',
        salePrice: '',
        stock: '',
        imageUrl: '',
        isNew: false,
        isOnSale: false,
    };
    const categories = ['Pets', 'Gears', 'Sheckles', 'Other']; // Ensure 'Other' is an option

    let products = []; // Local array to hold product data
    let orders = [];   // Local array to hold order data

    // Modals
    const editProductModal = document.getElementById('order-detail-modal'); // Reusing order detail modal for edit product
    const orderDetailModal = document.getElementById('order-detail-modal'); // Reusing order detail modal for order details
    let currentSelectedOrderId = null; // To keep track of the order being viewed/edited


    /**
     * Renders the main admin panel UI.
     */
    function renderAdminPanel() {
        if (!adminPanelContainer) {
            adminPanelContainer = document.createElement('div');
            adminPanelContainer.className = "container mx-auto p-6";
            mainContent.appendChild(adminPanelContainer);
        }

        adminPanelContainer.innerHTML = `
            <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Admin Panel</h2>

            <div class="flex justify-center mb-6">
                <button id="product-management-tab" class="px-6 py-3 rounded-l-lg font-semibold text-lg transition duration-300 bg-blue-600 text-white shadow-md">
                    Product Management
                </button>
                <button id="order-management-tab" class="px-6 py-3 rounded-r-lg font-semibold text-lg transition duration-300 bg-gray-200 text-gray-700 hover:bg-gray-300">
                    Order Management
                </button>
            </div>

            <div id="admin-content-area" class="bg-white rounded-xl shadow-lg p-6">
                <!-- Content for active tab will be injected here -->
            </div>
        `;

        // Attach event listeners for tab switching
        document.getElementById('product-management-tab').addEventListener('click', () => {
            setActiveTab('product-management');
        });
        document.getElementById('order-management-tab').addEventListener('click', () => {
            setActiveTab('order-management');
        });

        // Set initial tab content
        setActiveTab('product-management');
    }

    /**
     * Sets the active tab in the admin panel and renders its content.
     * @param {string} tabName - 'product-management' or 'order-management'.
     */
    function setActiveTab(tabName) {
        const productTabBtn = document.getElementById('product-management-tab');
        const orderTabBtn = document.getElementById('order-management-tab');
        const contentArea = document.getElementById('admin-content-area');

        // Update button styles
        if (tabName === 'product-management') {
            productTabBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            productTabBtn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            orderTabBtn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            orderTabBtn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            renderProductManagement();
        } else if (tabName === 'order-management') {
            orderTabBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            orderTabBtn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            productTabBtn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            productTabBtn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            renderOrderManagement();
        }
    }

    /**
     * Renders the product management section.
     */
    function renderProductManagement() {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <h3 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Add New Product</h3>
            <form id="add-product-form" class="space-y-4 mb-8">
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="admin-product-name">
                        Name
                    </label>
                    <input type="text" id="admin-product-name" name="name" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="admin-product-category">
                        Category
                    </label>
                    <select id="admin-product-category" name="category" class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                        <option value="">Select a category</option>
                        ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="admin-product-price">
                        Price (₱)
                    </label>
                    <input type="number" id="admin-product-price" name="price" step="0.01" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="admin-product-sale-price">
                        Sale Price (₱) (optional)
                    </label>
                    <input type="number" id="admin-product-sale-price" name="salePrice" step="0.01" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="admin-product-stock">
                        Stock
                    </label>
                    <input type="number" id="admin-product-stock" name="stock" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="admin-product-image-url">
                        Product Image Filename (e.g., `item.png`)
                    </label>
                    <input type="text" id="admin-product-image-url" name="imageUrl" placeholder="e.g., my-product.png" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                    <p class="text-xs text-gray-500 mt-1">Place image files in the <code>/images</code> folder in your GitHub repo.</p>
                </div>
                <div class="flex items-center space-x-4">
                    <label class="flex items-center">
                        <input type="checkbox" id="admin-product-is-new" name="isNew" class="form-checkbox h-5 w-5 text-blue-600 rounded">
                        <span class="ml-2 text-gray-700">New Product</span>
                    </label>
                    <label class="flex items-center">
                        <input type="checkbox" id="admin-product-is-on-sale" name="isOnSale" class="form-checkbox h-5 w-5 text-blue-600 rounded">
                        <span class="ml-2 text-gray-700">On Sale</span>
                    </label>
                </div>
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 shadow-md">
                    Add Product
                </button>
            </form>

            <h3 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Existing Products</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (₱)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="products-table-body" class="bg-white divide-y divide-gray-200">
                        <!-- Products will be injected here -->
                    </tbody>
                </table>
            </div>
        `;

        // Attach event listener for adding products
        document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);
        populateProductForm(productForm); // Populate form with current state

        // Re-render product table
        renderProductsTable();
    }

    /**
     * Populates the product form with provided data.
     * @param {object} data - Product data to populate the form.
     */
    function populateProductForm(data) {
        document.getElementById('admin-product-name').value = data.name;
        document.getElementById('admin-product-category').value = data.category;
        document.getElementById('admin-product-price').value = data.price;
        document.getElementById('admin-product-sale-price').value = data.salePrice || '';
        document.getElementById('admin-product-stock').value = data.stock;
        document.getElementById('admin-product-image-url').value = data.imageUrl;
        document.getElementById('admin-product-is-new').checked = data.isNew;
        document.getElementById('admin-product-is-on-sale').checked = data.isOnSale;
    }

    /**
     * Resets the product form to its default empty state.
     */
    function resetProductForm() {
        productForm = {
            id: null,
            name: '',
            category: '',
            price: '',
            salePrice: '',
            stock: '',
            imageUrl: '',
            isNew: false,
            isOnSale: false,
        };
        populateProductForm(productForm);
    }

    /**
     * Renders the product table with current product data.
     */
    function renderProductsTable() {
        const productsTableBody = document.getElementById('products-table-body');
        if (!productsTableBody) return;

        productsTableBody.innerHTML = products.map(product => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <img src="${product.imageUrl || `https://placehold.co/40x40/F0F4F8/1F2937?text=?`}" alt="${product.name}" class="h-10 w-10 rounded-full object-cover" onerror="this.onerror=null; this.src='https://placehold.co/40x40/F0F4F8/1F2937?text=?';" />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${product.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.category}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₱${product.price.toFixed(2)}
                    ${product.isOnSale && product.salePrice && product.salePrice < product.price ?
                        `<span class="block text-xs text-red-500 line-through">₱${product.salePrice.toFixed(2)}</span>` : ''
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.stock}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${product.isNew ? '<span class="mr-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">New</span>' : ''}
                    ${product.isOnSale ? '<span class="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs">Sale</span>' : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-product-id="${product.id}" class="edit-product-btn text-indigo-600 hover:text-indigo-900 mr-4">
                        Edit
                    </button>
                    <button data-product-id="${product.id}" class="delete-product-btn text-red-600 hover:text-red-900">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');

        // Attach event listeners for edit and delete buttons
        productsTableBody.querySelectorAll('.edit-product-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.productId;
                const productToEdit = products.find(p => p.id === productId);
                if (productToEdit) {
                    handleEditProductClick(productToEdit);
                }
            });
        });
        productsTableBody.querySelectorAll('.delete-product-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.productId;
                handleDeleteProduct(productId);
            });
        });
    }


    /**
     * Handles adding a new product to Firestore.
     * @param {Event} e - Submit event.
     */
    async function handleAddProduct(e) {
        e.preventDefault();
        if (!window.db) {
            window.openMessage("Firebase not initialized.", 'error');
            return;
        }

        const newProduct = {
            name: document.getElementById('admin-product-name').value,
            category: document.getElementById('admin-product-category').value,
            price: parseFloat(document.getElementById('admin-product-price').value),
            salePrice: document.getElementById('admin-product-sale-price').value ? parseFloat(document.getElementById('admin-product-sale-price').value) : null,
            stock: parseInt(document.getElementById('admin-product-stock').value, 10),
            imageUrl: `/images/${document.getElementById('admin-product-image-url').value}`, // Prepend /images/
            isNew: document.getElementById('admin-product-is-new').checked,
            isOnSale: document.getElementById('admin-product-is-on-sale').checked,
        };

        try {
            await window.addDoc(window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`), newProduct);
            window.openMessage('Product added successfully!', 'success');
            resetProductForm(); // Clear the form
        } catch (error) {
            console.error("Error adding product:", error);
            window.openMessage(`Failed to add product: ${error.message}`, 'error');
        }
    }

    /**
     * Fills the edit product modal with product data.
     * @param {object} product - The product object to edit.
     */
    function handleEditProductClick(product) {
        // Populate productForm state for editing
        productForm = {
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            salePrice: product.salePrice || '',
            stock: product.stock,
            imageUrl: product.imageUrl.startsWith('/images/') ? product.imageUrl.substring(8) : product.imageUrl || '', // Remove /images/ prefix for input
            isNew: product.isNew || false,
            isOnSale: product.isOnSale || false,
        };

        const modalTitle = document.getElementById('order-detail-title'); // Reusing this for edit product
        modalTitle.textContent = 'Edit Product';

        const orderDetailsInfo = document.getElementById('order-details-info'); // Reusing this area for product form
        orderDetailsInfo.innerHTML = `
            <form id="edit-product-form" class="space-y-4">
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-name">Name</label>
                    <input type="text" id="edit-product-name" name="name" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productForm.name}" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-category">Category</label>
                    <select id="edit-product-category" name="category" class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                        ${categories.map(cat => `<option value="${cat}" ${productForm.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-price">Price (₱)</label>
                    <input type="number" id="edit-product-price" name="price" step="0.01" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productForm.price}" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-sale-price">Sale Price (₱) (optional)</label>
                    <input type="number" id="edit-product-sale-price" name="salePrice" step="0.01" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productForm.salePrice}">
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-stock">Stock</label>
                    <input type="number" id="edit-product-stock" name="stock" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productForm.stock}" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-image-url">Product Image Filename</label>
                    <input type="text" id="edit-product-image-url" name="imageUrl" placeholder="e.g., my-product.png" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productForm.imageUrl}">
                    <p class="text-xs text-gray-500 mt-1">Place image files in the <code>/images</code> folder in your GitHub repo.</p>
                </div>
                <div class="flex items-center space-x-4">
                    <label class="flex items-center">
                        <input type="checkbox" id="edit-product-is-new" name="isNew" class="form-checkbox h-5 w-5 text-blue-600 rounded" ${productForm.isNew ? 'checked' : ''}>
                        <span class="ml-2 text-gray-700">New Product</span>
                    </label>
                    <label class="flex items-center">
                        <input type="checkbox" id="edit-product-is-on-sale" name="isOnSale" class="form-checkbox h-5 w-5 text-blue-600 rounded" ${productForm.isOnSale ? 'checked' : ''}>
                        <span class="ml-2 text-gray-700">On Sale</span>
                    </label>
                </div>
                <div class="flex justify-end space-x-4">
                    <button type="button" id="cancel-edit-product" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300">
                        Cancel Edit
                    </button>
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 shadow-md">
                        Save Changes
                    </button>
                </div>
            </form>
        `;
        document.getElementById('order-detail-items-list').innerHTML = ''; // Clear items list in modal
        document.getElementById('order-detail-total').innerHTML = ''; // Clear total in modal
        document.getElementById('admin-order-status-update').classList.add('hidden'); // Hide order status update

        document.getElementById('edit-product-form').addEventListener('submit', handleUpdateProduct);
        document.getElementById('cancel-edit-product').addEventListener('click', () => window.closeModal('order-detail-modal'));

        window.openModal('order-detail-modal');
    }

    /**
     * Handles updating an existing product in Firestore.
     * @param {Event} e - Submit event.
     */
    async function handleUpdateProduct(e) {
        e.preventDefault();
        if (!window.db || !productForm.id) {
            window.openMessage("Firebase not initialized or product ID missing.", 'error');
            return;
        }

        const updatedProduct = {
            name: document.getElementById('edit-product-name').value,
            category: document.getElementById('edit-product-category').value,
            price: parseFloat(document.getElementById('edit-product-price').value),
            salePrice: document.getElementById('edit-product-sale-price').value ? parseFloat(document.getElementById('edit-product-sale-price').value) : null,
            stock: parseInt(document.getElementById('edit-product-stock').value, 10),
            imageUrl: `/images/${document.getElementById('edit-product-image-url').value}`, // Prepend /images/
            isNew: document.getElementById('edit-product-is-new').checked,
            isOnSale: document.getElementById('edit-product-is-on-sale').checked,
        };

        try {
            const productRef = window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`, productForm.id);
            await window.updateDoc(productRef, updatedProduct);
            window.openMessage('Product updated successfully!', 'success');
            window.closeModal('order-detail-modal'); // Close the modal
            resetProductForm(); // Reset form state
        } catch (error) {
            console.error("Error updating product:", error);
            window.openMessage(`Failed to update product: ${error.message}`, 'error');
        }
    }

    /**
     * Handles deleting a product from Firestore.
     * @param {string} productId - The ID of the product to delete.
     */
    async function handleDeleteProduct(productId) {
        if (!window.db) {
            window.openMessage("Firebase not initialized.", 'error');
            return;
        }
        if (confirm("Are you sure you want to delete this product?")) { // Using browser confirm for admin actions
            try {
                await window.deleteDoc(window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`, productId));
                window.openMessage('Product deleted successfully!', 'success');
            } catch (error) {
                console.error("Error deleting product:", error);
                window.openMessage(`Failed to delete product: ${error.message}`, 'error');
            }
        }
    }


    /**
     * Renders the order management section.
     */
    function renderOrderManagement() {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <h3 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">All Orders</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Email</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" class="relative px-6 py-3"><span class="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody id="orders-table-body" class="bg-white divide-y divide-gray-200">
                        <!-- Orders will be injected here -->
                    </tbody>
                </table>
            </div>
        `;

        renderOrdersTable();
    }

    /**
     * Renders the orders table with current order data.
     */
    function renderOrdersTable() {
        const ordersTableBody = document.getElementById('orders-table-body');
        if (!ordersTableBody) return;

        ordersTableBody.innerHTML = orders.map(order => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate">${order.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate">${order.userEmail || order.userId}</td>
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
                    <button data-order-id="${order.id}" class="view-order-details-admin-btn text-blue-600 hover:text-blue-900">
                        View
                    </button>
                </td>
            </tr>
        `).join('');

        ordersTableBody.querySelectorAll('.view-order-details-admin-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.target.dataset.orderId;
                const orderToView = orders.find(o => o.id === orderId);
                if (orderToView) {
                    viewOrderDetailsAdmin(orderToView);
                }
            });
        });
    }

    /**
     * Displays order details for the admin.
     * @param {object} order - The order object to display.
     */
    function viewOrderDetailsAdmin(order) {
        currentSelectedOrderId = order.id; // Store for status updates
        const modalTitle = document.getElementById('order-detail-title');
        const orderDetailsInfo = document.getElementById('order-details-info');
        const orderDetailItemsList = document.getElementById('order-detail-items-list');
        const orderDetailTotal = document.getElementById('order-detail-total');
        const adminOrderStatusUpdate = document.getElementById('admin-order-status-update');

        modalTitle.textContent = `Order ID: ${order.id}`;
        orderDetailsInfo.innerHTML = `
            <p><strong>User Email:</strong> ${order.userEmail || 'N/A'}</p>
            <p><strong>User ID:</strong> ${order.userId}</p>
            <p><strong>Date:</strong> ${order.orderDate}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            ${order.robloxUsername ? `<p><strong>Roblox Username:</strong> ${order.robloxUsername}</p>` : ''}
            <p><strong>Current Status:</strong> <span class="status-badge ${
                order.status === 'In Process' ? 'status-in-process' :
                order.status === 'Delivered' ? 'status-delivered' :
                'status-rejected'
            }">${order.status}</span></p>
        `;

        orderDetailItemsList.innerHTML = order.items.map(item => `
            <li class="text-gray-700">
                ${item.name} (x${item.quantity}) - ₱${item.price.toFixed(2)} each
            </li>
        `).join('');

        orderDetailTotal.innerHTML = `Total Amount: ₱${order.totalAmount.toFixed(2)}`;

        // Show status update buttons for admin
        adminOrderStatusUpdate.classList.remove('hidden');
        adminOrderStatusUpdate.querySelectorAll('button').forEach(button => {
            button.onclick = () => handleUpdateOrderStatus(order.id, button.dataset.status);
        });

        window.openModal('order-detail-modal');
    }

    /**
     * Updates the status of an order in Firestore.
     * @param {string} orderId - The ID of the order to update.
     * @param {string} newStatus - The new status (e.g., 'In Process', 'Delivered', 'Rejected').
     */
    async function handleUpdateOrderStatus(orderId, newStatus) {
        if (!window.db) {
            window.openMessage("Firebase not initialized.", 'error');
            return;
        }
        try {
            const orderRef = window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/orders`, orderId);
            await window.updateDoc(orderRef, { status: newStatus });
            window.openMessage(`Order ${orderId} status updated to ${newStatus}!`, 'success');
            window.closeModal('order-detail-modal'); // Close modal after update
        } catch (error) {
            console.error("Error updating order status:", error);
            window.openMessage(`Failed to update order status: ${error.message}`, 'error');
        }
    }


    // --- Firebase Data Listeners (Admin Specific) ---

    // Listener for products (Admin Panel)
    let unsubscribeProducts = null;
    function setupProductListener() {
        if (unsubscribeProducts) unsubscribeProducts(); // Clean up previous listener
        if (!window.db || !window.isAdmin || window.firebaseLoading) return;

        const productsCollectionRef = window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`);
        unsubscribeProducts = window.onSnapshot(
            productsCollectionRef,
            (snapshot) => {
                const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                products = productsData; // Update global products array
                renderProductsTable(); // Re-render table if on product management tab
            },
            (err) => {
                console.error("Error fetching products for admin:", err);
                window.openMessage("Failed to load products in admin panel.", 'error');
            }
        );
    }

    // Listener for orders (Admin Panel)
    let unsubscribeOrders = null;
    function setupOrderListener() {
        if (unsubscribeOrders) unsubscribeOrders(); // Clean up previous listener
        if (!window.db || !window.isAdmin || window.firebaseLoading) return;

        const ordersCollectionRef = window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/orders`);
        // Note: Admin gets all orders, no 'where' clause for user ID
        unsubscribeOrders = window.onSnapshot(
            ordersCollectionRef,
            (snapshot) => {
                const ordersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    orderDate: doc.data().orderDate?.toDate().toLocaleString() || 'N/A',
                }));
                // Sort orders by date, newest first
                ordersData.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
                orders = ordersData; // Update global orders array
                renderOrdersTable(); // Re-render table if on order management tab
            },
            (err) => {
                console.error("Error fetching orders for admin:", err);
                window.openMessage("Failed to load orders in admin panel.", 'error');
            }
        );
    }


    // --- Event Listeners and Initial Load ---

    // Listen for custom event that signals Firebase is ready and user is authenticated
    document.addEventListener('firebaseAuthReady', () => {
        if (window.isAdmin) {
            setupProductListener();
            setupOrderListener();
        } else {
            // If not admin, ensure listeners are cleaned up if they were ever set
            if (unsubscribeProducts) unsubscribeProducts();
            if (unsubscribeOrders) unsubscribeOrders();
        }
    });

    // Listen for navigation event to 'admin-panel'
    document.addEventListener('navigateTo', (event) => {
        if (event.detail === 'admin-panel') {
            mainContent.innerHTML = ''; // Clear main content
            if (!window.firebaseLoading) {
                if (window.isAdmin) {
                    renderAdminPanel();
                    setupProductListener(); // Re-initialize in case of navigation
                    setupOrderListener();   // Re-initialize in case of navigation
                } else {
                    mainContent.innerHTML = `
                        <div class="text-center py-20">
                            <h2 class="text-3xl font-bold text-red-600 mb-4">Access Denied</h2>
                            <p class="text-lg text-gray-700">You do not have administrative privileges to view this page.</p>
                        </div>
                    `;
                }
            } else {
                 mainContent.innerHTML = `<div class="text-center py-10 text-gray-600">Loading Admin Panel...</div>`;
                 // Wait for firebaseAuthReady event
                 document.addEventListener('firebaseAuthReady', () => {
                     if (window.isAdmin) {
                         renderAdminPanel();
                         setupProductListener();
                         setupOrderListener();
                     } else {
                         mainContent.innerHTML = `
                             <div class="text-center py-20">
                                 <h2 class="text-3xl font-bold text-red-600 mb-4">Access Denied</h2>
                                 <p class="text-lg text-gray-700">You do not have administrative privileges to view this page.</p>
                             </div>
                         `;
                     }
                 }, { once: true }); // Ensure this listener runs only once
            }
        }
    });

});
