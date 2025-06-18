// admin.js - Admin Panel Logic
// This script assumes Firebase has been initialized and
// global variables like window.db, window.auth, window.currentUser,
// window.userId, window.isAdmin, window.firebaseLoading, window.openMessage,
// window.openModal, window.closeModal, window.USER_FIREBASE_CONFIG,
// and window.ADMIN_UID are available from index.html.

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements for the Admin Panel
    const mainContent = document.getElementById('main-content');
    let adminPanelContainer = null; // Will be created dynamically

    // Product Management Form Elements (used for both add and edit)
    let productFormState = { // Use a different name to avoid conflict with `productForm` in function scope
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
    const categories = ['Pets', 'Gears', 'Sheckles', 'Other'];

    let products = []; // Local array to hold product data
    let orders = [];   // Local array to hold order data

    // Modals (reusing existing modal for product edit and order detail)
    const orderDetailModal = document.getElementById('order-detail-modal');
    let currentSelectedOrderId = null; // To keep track of the order being viewed/edited
    let currentDeleteProductId = null; // To keep track of product being deleted

    // Custom Confirmation Modal (for delete actions)
    let confirmActionCallback = null; // Callback for the custom confirmation modal

    /**
     * Shows a custom confirmation modal.
     * @param {string} message - The message to display.
     * @param {function} onConfirm - Callback to execute if confirmed.
     */
    function showConfirmationModal(message, onConfirm) {
        const modalId = 'custom-confirm-modal'; // A new dedicated modal for confirmation
        let confirmModal = document.getElementById(modalId);

        if (!confirmModal) {
            confirmModal = document.createElement('div');
            confirmModal.id = modalId;
            confirmModal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 hidden";
            confirmModal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl w-full max-w-sm mx-auto p-6 relative">
                    <button class="modal-close-confirm absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold">&times;</button>
                    <h2 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Confirm Action</h2>
                    <p id="confirm-message" class="mb-6">${message}</p>
                    <div class="flex justify-end space-x-4">
                        <button id="confirm-cancel-btn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300">Cancel</button>
                        <button id="confirm-ok-btn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmModal);

            document.querySelector(`#${modalId} .modal-close-confirm`).addEventListener('click', () => {
                confirmModal.classList.add('hidden');
                confirmActionCallback = null;
            });
            document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
                confirmModal.classList.add('hidden');
                confirmActionCallback = null;
            });
            document.getElementById('confirm-ok-btn').addEventListener('click', () => {
                confirmModal.classList.add('hidden');
                if (confirmActionCallback) {
                    confirmActionCallback();
                }
                confirmActionCallback = null;
            });
        } else {
            document.getElementById('confirm-message').textContent = message;
        }

        confirmActionCallback = onConfirm;
        confirmModal.classList.remove('hidden');
    }


    /**
     * Renders the main admin panel UI.
     */
    function renderAdminPanel() {
        console.log('Rendering Admin Panel UI...');
        if (!adminPanelContainer) {
            adminPanelContainer = document.createElement('div');
            adminPanelContainer.className = "container mx-auto p-6";
            mainContent.appendChild(adminPanelContainer);
        }

        adminPanelContainer.innerHTML = `
            <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Admin Panel</h2>

            <div class="flex justify-center mb-6">
                <button id="product-management-tab" class="px-6 py-3 rounded-l-lg font-semibold text-lg transition duration-300">
                    Product Management
                </button>
                <button id="order-management-tab" class="px-6 py-3 rounded-r-lg font-semibold text-lg transition duration-300">
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
        console.log('Rendering Product Management Tab');
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
        populateProductForm(productFormState); // Populate form with current state

        // Re-render product table
        renderProductsTable();
    }

    /**
     * Populates the product form (add/edit) with provided data.
     * @param {object} data - Product data to populate the form.
     */
    function populateProductForm(data) {
        // This function needs to handle elements from both add and edit forms,
        // or be called in context where only relevant elements exist.
        // For simplicity, we assume elements exist when called after respective renders.
        const nameInput = document.getElementById('admin-product-name') || document.getElementById('edit-product-name');
        const categorySelect = document.getElementById('admin-product-category') || document.getElementById('edit-product-category');
        const priceInput = document.getElementById('admin-product-price') || document.getElementById('edit-product-price');
        const salePriceInput = document.getElementById('admin-product-sale-price') || document.getElementById('edit-product-sale-price');
        const stockInput = document.getElementById('admin-product-stock') || document.getElementById('edit-product-stock');
        const imageUrlInput = document.getElementById('admin-product-image-url') || document.getElementById('edit-product-image-url');
        const isNewCheckbox = document.getElementById('admin-product-is-new') || document.getElementById('edit-product-is-new');
        const isOnSaleCheckbox = document.getElementById('admin-product-is-on-sale') || document.getElementById('edit-product-is-on-sale');

        if (nameInput) nameInput.value = data.name || '';
        if (categorySelect) categorySelect.value = data.category || '';
        if (priceInput) priceInput.value = data.price || '';
        if (salePriceInput) salePriceInput.value = data.salePrice || '';
        if (stockInput) stockInput.value = data.stock || '';
        if (imageUrlInput) imageUrlInput.value = data.imageUrl ? (data.imageUrl.startsWith('/images/') ? data.imageUrl.substring(8) : data.imageUrl) : '';
        if (isNewCheckbox) isNewCheckbox.checked = data.isNew || false;
        if (isOnSaleCheckbox) isOnSaleCheckbox.checked = data.isOnSale || false;
    }

    /**
     * Resets the product form to its default empty state.
     */
    function resetProductFormState() {
        productFormState = {
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
        // If the form is currently rendered, clear its inputs
        if (document.getElementById('add-product-form')) {
            populateProductForm(productFormState);
        }
    }

    /**
     * Renders the product table with current product data.
     */
    function renderProductsTable() {
        const productsTableBody = document.getElementById('products-table-body');
        if (!productsTableBody) return; // Exit if the element isn't currently in the DOM

        productsTableBody.innerHTML = products.map(product => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <img src="${product.imageUrl || `https://placehold.co/40x40/F0F4F8/1F2937?text=?`}" alt="${product.name}" class="h-10 w-10 rounded-full object-cover" onerror="this.onerror=null; this.src='https://placehold.co/40x40/F0F4F8/1F2937?text=?';" />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${product.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.category}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₱${(product.price || 0).toFixed(2)}
                    ${product.isOnSale && typeof product.salePrice === 'number' && product.salePrice < product.price ?
                        `<span class="block text-xs text-red-500 line-through">₱${product.salePrice.toFixed(2)}</span>` : ''
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.stock || 0}</td>
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

        // Attach event listeners for edit and delete buttons after rendering
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
                currentDeleteProductId = productId; // Store ID for confirmation
                showConfirmationModal("Are you sure you want to delete this product?", () => handleDeleteProductConfirmed(productId));
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
            // Ensure imageUrl starts with /images/
            imageUrl: `/images/${document.getElementById('admin-product-image-url').value.split('/').pop()}`,
            isNew: document.getElementById('admin-product-is-new').checked,
            isOnSale: document.getElementById('admin-product-is-on-sale').checked,
        };

        try {
            await window.addDoc(window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`), newProduct);
            window.openMessage('Product added successfully!', 'success');
            resetProductFormState(); // Clear the form
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
        productFormState = { // Populate productFormState for editing
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            salePrice: product.salePrice || '',
            stock: product.stock,
            // Remove /images/ prefix for input field display
            imageUrl: product.imageUrl ? (product.imageUrl.startsWith('/images/') ? product.imageUrl.substring(8) : product.imageUrl) : '',
            isNew: product.isNew || false,
            isOnSale: product.isOnSale || false,
        };

        const modalTitle = document.getElementById('order-detail-title');
        const orderDetailsInfo = document.getElementById('order-details-info'); // This div is reused for product edit form
        const orderDetailItemsList = document.getElementById('order-detail-items-list'); // Clear
        const orderDetailTotal = document.getElementById('order-detail-total'); // Clear
        const adminOrderStatusUpdate = document.getElementById('admin-order-status-update'); // Hide

        modalTitle.textContent = 'Edit Product';
        adminOrderStatusUpdate.classList.add('hidden'); // Hide order status update buttons

        // Clear previous content in the reused sections
        orderDetailItemsList.innerHTML = '';
        orderDetailTotal.innerHTML = '';

        orderDetailsInfo.innerHTML = `
            <form id="edit-product-form" class="space-y-4">
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-name">Name</label>
                    <input type="text" id="edit-product-name" name="name" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productFormState.name}" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-category">Category</label>
                    <select id="edit-product-category" name="category" class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                        ${categories.map(cat => `<option value="${cat}" ${productFormState.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-price">Price (₱)</label>
                    <input type="number" id="edit-product-price" name="price" step="0.01" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productFormState.price}" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-sale-price">Sale Price (₱) (optional)</label>
                    <input type="number" id="edit-product-sale-price" name="salePrice" step="0.01" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productFormState.salePrice}">
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-stock">Stock</label>
                    <input type="number" id="edit-product-stock" name="stock" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productFormState.stock}" required>
                </div>
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="edit-product-image-url">Product Image Filename</label>
                    <input type="text" id="edit-product-image-url" name="imageUrl" placeholder="e.g., my-product.png" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="${productFormState.imageUrl}">
                    <p class="text-xs text-gray-500 mt-1">Place image files in the <code>/images</code> folder in your GitHub repo.</p>
                </div>
                <div class="flex items-center space-x-4">
                    <label class="flex items-center">
                        <input type="checkbox" id="edit-product-is-new" name="isNew" class="form-checkbox h-5 w-5 text-blue-600 rounded" ${productFormState.isNew ? 'checked' : ''}>
                        <span class="ml-2 text-gray-700">New Product</span>
                    </label>
                    <label class="flex items-center">
                        <input type="checkbox" id="edit-product-is-on-sale" name="isOnSale" class="form-checkbox h-5 w-5 text-blue-600 rounded" ${productFormState.isOnSale ? 'checked' : ''}>
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
        if (!window.db || !productFormState.id) {
            window.openMessage("Firebase not initialized or product ID missing.", 'error');
            return;
        }

        const updatedProduct = {
            name: document.getElementById('edit-product-name').value,
            category: document.getElementById('edit-product-category').value,
            price: parseFloat(document.getElementById('edit-product-price').value),
            salePrice: document.getElementById('edit-product-sale-price').value ? parseFloat(document.getElementById('edit-product-sale-price').value) : null,
            stock: parseInt(document.getElementById('edit-product-stock').value, 10),
            imageUrl: `/images/${document.getElementById('edit-product-image-url').value.split('/').pop()}`, // Ensure /images/ prefix
            isNew: document.getElementById('edit-product-is-new').checked,
            isOnSale: document.getElementById('edit-product-is-on-sale').checked,
        };

        try {
            const productRef = window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`, productFormState.id);
            await window.updateDoc(productRef, updatedProduct);
            window.openMessage('Product updated successfully!', 'success');
            window.closeModal('order-detail-modal'); // Close the modal
            resetProductFormState(); // Reset form state
        } catch (error) {
            console.error("Error updating product:", error);
            window.openMessage(`Failed to update product: ${error.message}`, 'error');
        }
    }

    /**
     * Confirms and handles deleting a product from Firestore.
     * @param {string} productId - The ID of the product to delete.
     */
    async function handleDeleteProductConfirmed(productId) {
        if (!window.db) {
            window.openMessage("Firebase not initialized.", 'error');
            return;
        }
        try {
            await window.deleteDoc(window.doc(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`, productId));
            window.openMessage('Product deleted successfully!', 'success');
        } catch (error) {
            console.error("Error deleting product:", error);
            window.openMessage(`Failed to delete product: ${error.message}`, 'error');
        }
    }


    /**
     * Renders the order management section.
     */
    function renderOrderManagement() {
        console.log('Rendering Order Management Tab');
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

        renderOrdersTable(); // Populate the table
    }

    /**
     * Renders the orders table with current order data.
     */
    function renderOrdersTable() {
        const ordersTableBody = document.getElementById('orders-table-body');
        if (!ordersTableBody) return; // Exit if the element isn't currently in the DOM

        ordersTableBody.innerHTML = orders.map(order => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate">${order.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate">${order.userEmail || order.userId}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.orderDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱${(order.totalAmount || 0).toFixed(2)}</td>
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

        orderDetailItemsList.innerHTML = (order.items || []).map(item => `
            <li class="text-gray-700">
                ${item.name} (x${item.quantity || 1}) - ₱${(item.price || 0).toFixed(2)} each
            </li>
        `).join('');

        orderDetailTotal.innerHTML = `Total Amount: ₱${(order.totalAmount || 0).toFixed(2)}`;

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

    let unsubscribeProducts = null;
    /**
     * Sets up a real-time listener for public product data for admin.
     */
    function setupAdminProductListener() {
        if (unsubscribeProducts) unsubscribeProducts(); // Clean up previous listener
        if (!window.db || !window.isAdmin || window.firebaseLoading) {
             console.log("Admin product listener skipped: Firebase not ready or not admin.");
             return;
        }
        console.log("Setting up admin product listener.");
        const productsCollectionRef = window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/products`);
        unsubscribeProducts = window.onSnapshot(
            productsCollectionRef,
            (snapshot) => {
                const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                products = productsData; // Update local products array
                // Only re-render if the product management tab is currently active
                if (document.getElementById('admin-content-area') && document.getElementById('product-management-tab')?.classList.contains('bg-blue-600')) {
                    renderProductsTable();
                }
            },
            (err) => {
                console.error("Error fetching products for admin:", err);
                window.openMessage("Failed to load products in admin panel.", 'error');
            }
        );
    }

    let unsubscribeOrders = null;
    /**
     * Sets up a real-time listener for all orders for admin.
     */
    function setupAdminOrderListener() {
        if (unsubscribeOrders) unsubscribeOrders(); // Clean up previous listener
        if (!window.db || !window.isAdmin || window.firebaseLoading) {
            console.log("Admin order listener skipped: Firebase not ready or not admin.");
            return;
        }
        console.log("Setting up admin order listener.");
        const ordersCollectionRef = window.collection(window.db, `artifacts/${window.USER_FIREBASE_CONFIG.projectId}/public/data/orders`);
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
                orders = ordersData; // Update local orders array
                // Only re-render if the order management tab is currently active
                if (document.getElementById('admin-content-area') && document.getElementById('order-management-tab')?.classList.contains('bg-blue-600')) {
                    renderOrdersTable();
                }
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
        console.log('admin.js: Firebase Auth Ready event received. Is Admin:', window.isAdmin);
        if (window.isAdmin) {
            setupAdminProductListener();
            setupAdminOrderListener();
            // If already on admin-panel page, re-render
            if (mainContent.innerHTML.includes('Admin Panel')) { // Simple check
                renderAdminPanel();
            }
        } else {
            // If not admin, ensure listeners are cleaned up if they were ever set
            if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
            if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
        }
    });

    // Listen for navigation event to 'admin-panel'
    document.addEventListener('navigateTo', (event) => {
        if (event.detail === 'admin-panel') {
            console.log('admin.js: Navigating to Admin Panel.');
            mainContent.innerHTML = ''; // Clear main content

            if (!window.firebaseLoading) { // If Firebase is already loaded
                if (window.isAdmin) {
                    renderAdminPanel();
                    setupAdminProductListener(); // Ensure listeners are active
                    setupAdminOrderListener();   // Ensure listeners are active
                } else {
                    mainContent.innerHTML = `
                        <div class="text-center py-20">
                            <h2 class="text-3xl font-bold text-red-600 mb-4">Access Denied</h2>
                            <p class="text-lg text-gray-700">You do not have administrative privileges to view this page.</p>
                        </div>
                    `;
                }
            } else { // If Firebase is still loading
                 mainContent.innerHTML = `<div class="text-center py-10 text-gray-600">Loading Admin Panel...</div>`;
                 // Wait for firebaseAuthReady event, which will then trigger rendering
                 document.addEventListener('firebaseAuthReady', () => {
                     if (window.isAdmin) {
                         renderAdminPanel();
                         setupAdminProductListener();
                         setupAdminOrderListener();
                     } else {
                         mainContent.innerHTML = `
                             <div class="text-center py-20">
                                 <h2 class="text-3xl font-bold text-red-600 mb-4">Access Denied</h2>
                                 <p class="text-lg text-gray-700">You do not have administrative privileges to view this page.</p>
                             </div>
                         `;
                     }
                 }, { once: true }); // Ensure this listener runs only once for this specific navigation
            }
        }
    });

});
