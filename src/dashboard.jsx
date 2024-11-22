
import React, { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import Papa from "papaparse"; // Import PapaParse for CSV/JSON parsing
import app from "./firebase-config"; // Ensure this path is correct
import "./dashboard.css";
import { useAuth } from "./AuthProvider"; // Import useAuth hook
import AccountPage from "./accountspage.jsx";
import { categoryTree } from "./categoryData"; // Categories data

// ListingTable component to display the list of products
const ListingTable = ({
  listings,
  onEditClick,
  onDeleteClick,
  selectedIds,
  onSelectChange,
}) => (
  <div className="table-container">
    <table>
      <thead>
        <tr>
          <th>
            <input
              type="checkbox"
              onChange={(e) => onSelectChange(e.target.checked, "all")}
            />
          </th>
          <th>Title</th>
          <th>Sold</th>
          <th>Dimensions</th>
          <th>Price</th>
          <th>Profit</th>
          <th>eBay Link</th>
          <th>Supplier Info</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {listings.map((listing) => (
          <tr key={listing.id}>
            <td>
              <input
                type="checkbox"
                checked={selectedIds.includes(listing.id)}
                onChange={(e) => onSelectChange(e.target.checked, listing.id)}
              />
            </td>
            <td>{listing.Title}</td>
            <td>{listing.Sold}</td>
            <td>{listing.Dimensions}</td>
            <td>${parseFloat(listing.Price).toFixed(2)}</td>
            <td>${parseFloat(listing.Profit).toFixed(2)}</td>
            <td>
              <a href={listing.ProductOnEbay} target="_blank" rel="noopener noreferrer">
                View on eBay
              </a>
            </td>
            <td>
              <a href={listing.Source} target="_blank" rel="noopener noreferrer">
                Supplier Info
              </a>
            </td>
            <td>
              <button className="btn-edit" onClick={() => onEditClick(listing)}>
                Edit
              </button>
              <button
                className="btn-delete"
                onClick={() => onDeleteClick(listing.id)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// RecursiveDropdown for category selection
const RecursiveDropdown = ({ categories, onCategorySelect }) => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [subCategories, setSubCategories] = useState(null);

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    const subCats = categories[category];
    setSubCategories(subCats && !subCats.Listing ? subCats : null);
    onCategorySelect(subCats && subCats.Listing ? category : null);
  };

  return (
    <div className="input-grid">
      <select onChange={handleCategoryChange} value={selectedCategory}>
        <option value="">Select a category</option>
        {Object.keys(categories).map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      {subCategories && (
        <RecursiveDropdown
          categories={subCategories}
          onCategorySelect={onCategorySelect}
        />
      )}
    </div>
  );
};

// Main Dashboard component
const Dashboard = () => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [sold, setSold] = useState("");
  const [productOnEbay, setProductOnEbay] = useState("");
  const [source, setSource] = useState("");
  const [price, setPrice] = useState("");
  const [profit, setProfit] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [file, setFile] = useState(null); // For bulk upload file
  const [selectedIds, setSelectedIds] = useState([]); // Track selected product IDs for bulk actions
  const [activityLogs, setActivityLogs] = useState([]); // Activity logs

  const { currentUser, logout } = useAuth();
  const db = getFirestore(app);

  const handleLogout = async () => {
    try {
      await logout();
      alert("Logged out successfully!");
    } catch (error) {
      console.error("Logout Failed", error);
    }
  };

  const resetFormFields = () => {
    setTitle("");
    setCategory("");
    setSold("");
    setProductOnEbay("");
    setSource("");
    setPrice("");
    setProfit("");
    setDimensions("");
    setImageUrl("");
    setEditingProduct(null);
  };


  const logAction = async (actionType, details) => {
    try {
      await addDoc(collection(getFirestore(app), "activity_logs"), {
        type: actionType,
        details,
        userEmail: currentUser.email,  // Logging user email
        changesCount: details.changesCount || 1, // How many changes were made
        changedFields: details.changedFields || null,  // What changed
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Failed to log action:", error);
    }
  };
  

  const handleEditClick = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
    setTitle(product.Title);
    setCategory(product.Category);
    setSold(product.Sold);
    setProductOnEbay(product.ProductOnEbay);
    setSource(product.Source);
    setPrice(product.Price);
    setProfit(product.Profit);
    setDimensions(product.Dimensions);
    //setImageUrl(product.ImageUrl);
  };


  const handleDelete = async (id) => {
    try {
      const productRef = doc(db, "products", id);
      await deleteDoc(productRef);
      alert("Product deleted successfully!");
      setProducts(products.filter((product) => product.id !== id));
  
      const logDetails = {
        id,
        changesCount: 1, // Only one change for delete
        changedFields: ["Product deleted"], // We can just note that the product was deleted
      };
  
      await logAction("delete", logDetails);
    } catch (error) {
      console.error("Error deleting product: ", error);
      alert("Error deleting product!");
    }
  };
  

  const handleBulkDelete = async () => {
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        const productRef = doc(db, "products", id);
        batch.delete(productRef);
      });
      await batch.commit();
      setProducts(products.filter((product) => !selectedIds.includes(product.id)));
      setSelectedIds([]);
      logAction("bulk_delete", { success_count: selectedIds.length, failed_count: 0 });
      alert("Bulk delete successful!");
    } catch (error) {
      console.error("Error during bulk delete:", error);
      alert("Bulk delete failed. Please try again.");
    }
  };

  const handleSelectChange = (checked, id) => {
    if (id === "all") {
      setSelectedIds(checked ? products.map((product) => product.id) : []);
    } else {
      setSelectedIds((prevIds) =>
        checked ? [...prevIds, id] : prevIds.filter((productId) => productId !== id)
      );
    }
  };

 

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      let logDetails;
      if (editingProduct) {
        const productRef = doc(db, "products", editingProduct.id);
        const updateDetails = {
          Title: title,
          Category: selectedCategory,
          Sold: sold,
          ProductOnEbay: productOnEbay,
          Source: source,
          Price: parseFloat(price),
          Profit: parseFloat(profit),
          Dimensions: dimensions,
          ImageUrl: imageUrl,
        };
  
        // Log the fields that have changed
        const changedFields = [];
        if (title !== editingProduct.Title) changedFields.push('Title');
        if (category !== editingProduct.Category) changedFields.push('Category');
        if (sold !== editingProduct.Sold) changedFields.push('Sold');
        if (price !== editingProduct.Price) changedFields.push('Price');
        if (profit !== editingProduct.Profit) changedFields.push('Profit');
        if (dimensions !== editingProduct.Dimensions) changedFields.push('Dimensions');
  
        // Log the action
        logDetails = {
          id: editingProduct.id,
          updateDetails,
          changesCount: changedFields.length,
          changedFields,
        };
  
        await updateDoc(productRef, updateDetails);
        alert("Product updated successfully!");
        await logAction("update", logDetails);
      } else {
        const newDocRef = await addDoc(collection(db, "products"), {
          Title: title,
          Category: selectedCategory,
          Sold: sold,
          ProductOnEbay: productOnEbay,
          Source: source,
          Price: parseFloat(price),
          Profit: parseFloat(profit),
          Dimensions: dimensions,
          ImageUrl: imageUrl,
        });
  
        logDetails = {
          id: newDocRef.id,
          Title: title,
          Category: selectedCategory,
          Sold: sold,
          ProductOnEbay: productOnEbay,
          Source: source,
          Price: parseFloat(price),
          Profit: parseFloat(profit),
          Dimensions: dimensions,
          ImageUrl: imageUrl,
          changesCount: 1, // Only one change for adding
          changedFields: ["All fields"], // In case of add, we log all fields
        };
  
        alert("Product added successfully!");
        await logAction("add", logDetails);
      }
  
      setIsModalOpen(false);
      resetFormFields();
    } catch (error) {
      console.error("Error saving the product: ", error);
      alert("Error saving product!");
    }
  };
  

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const parseFile = async () => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error),
      });
    });
  };

  const handleBulkUpload = async () => {
    if (!file) {
      alert("Please upload a file first.");
      return;
    }

    try {
      const data = await parseFile();
      const validProducts = data.filter(
        (product) =>
          product.title && product.sold && product.price && product.profit
      );

      if (validProducts.length === 0) {
        alert("No valid products to upload.");
        return;
      }

      const batch = writeBatch(db);
      const productsRef = collection(db, "products");

      validProducts.forEach((product) => {
        const docRef = doc(productsRef);
        batch.set(docRef, {
          Title: product.title,
          Sold: product.sold,
          ProductOnEbay: product.productOnEbay,
          Source: product.source,
          Price: parseFloat(product.price),
          Profit: parseFloat(product.profit),
          Dimensions: product.dimensions,
         // ImageUrl: product.imageUrl,
        });
      });

      await batch.commit();
      setProducts((prev) => [...prev, ...validProducts]);
      logAction("bulk_add", { success_count: validProducts.length, failed_count: 0 });
      alert("Bulk upload successful!");
    } catch (error) {
      console.error("Error during bulk upload:", error);
      alert("Bulk upload failed. Please try again.");
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      const productsCollection = collection(db, "products");
      const productSnapshot = await getDocs(productsCollection);
      const productList = productSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productList);
    };

    fetchProducts();
  }, []);

  return (
    <>
      <div className="addproduct-dashboard">
        <h1>Add New Product</h1>
        <form onSubmit={handleSubmit}>
          <RecursiveDropdown
            categories={categoryTree}
            onCategorySelect={setSelectedCategory}
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
          />
          <div className="input-group">
            <input
              type="text"
              value={sold}
              onChange={(e) => setSold(e.target.value)}
              placeholder="Sold"
              required
            />
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              required
            />
            <input
              type="number"
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
              placeholder="Profit"
              required
            />
            <input
              type="text"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="Dimensions"
              required
            />
          </div>
          <input
            type="text"
            value={productOnEbay}
            onChange={(e) => setProductOnEbay(e.target.value)}
            placeholder="eBay Link"
            required
          />
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source Link"
            required
          />
          <button type="submit">Add Product</button>
        </form>
      </div>

      <div>
        <h3>Bulk Upload</h3>
        <input type="file" onChange={handleFileChange} accept=".csv, .json" />
        <button onClick={handleBulkUpload}>Upload Products</button>
      </div>

      <div className="product-list">
        <h2>Products</h2>
        <ListingTable
          listings={products.filter(
            (product) =>
              !selectedCategory || product.Category === selectedCategory
          )}
          onEditClick={handleEditClick}
          onDeleteClick={handleDelete}
          selectedIds={selectedIds}
          onSelectChange={handleSelectChange}
        />
      </div>

      <button onClick={handleBulkDelete}>Delete Selected Products</button>

      <AccountPage />
    </>
  );
};

export default Dashboard;




