// src/Dashboard.js

import React, { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import app from "./firebase-config"; // Ensure this path is correct
import "./dashboard.css";
import { useAuth } from "./AuthProvider"; // Import useAuth hook
import AccountPage from "./accountspage.jsx";
import { categoryTree } from "./categoryData";

const ListingTable = ({ listings, onEditClick, onDeleteClick }) => (
  <div className="table-container">
    <table>
      <thead>
        <tr>
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
            <td>{listing.Title}</td>
            <td>{listing.Sold}</td>
            <td>{listing.Dimensions}</td>
            <td>${parseFloat(listing.Price).toFixed(2)}</td>
            <td>${parseFloat(listing.Profit).toFixed(2)}</td>
            <td>
              <a
                href={listing.ProductOnEbay}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on eBay
              </a>
            </td>
            <td>
              <a
                href={listing.Source}
                target="_blank"
                rel="noopener noreferrer"
              >
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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        timestamp: new Date(),
        user: currentUser.email,
      });
    } catch (error) {
      console.error("Failed to log action:", error);
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
        await updateDoc(productRef, updateDetails);
        alert("Product updated successfully!");
        logDetails = { id: editingProduct.id, ...updateDetails };
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
        alert("Product added successfully!");
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
        };
        await logAction("add", logDetails);
      }
      setIsModalOpen(false);
      resetFormFields();
    } catch (error) {
      console.error("Error saving the product: ", error);
      alert("Error saving product!");
    }
  };

  const handleDelete = async (id) => {
    try {
      const productRef = doc(db, "products", id);
      await deleteDoc(productRef);
      alert("Product deleted successfully!");
      await logAction("delete", { id });
      setProducts(products.filter((product) => product.id !== id));
    } catch (error) {
      console.error("Error deleting product: ", error);
      alert("Error deleting product!");
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
    setImageUrl(product.ImageUrl);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetFormFields();
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
        <AccountPage />
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
            <div>
              <input
                type="text"
                value={sold}
                onChange={(e) => setSold(e.target.value)}
                placeholder="Sold"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <div>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price"
                required
              />
            </div>
            <div>
              <input
                type="number"
                value={profit}
                onChange={(e) => setProfit(e.target.value)}
                placeholder="Profit"
                required
              />
            </div>
            <div>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                placeholder="Dimensions"
                required
              />
            </div>
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

          <button
            type="submit"
            style={{
              marginTop: "10px",
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Add Product
          </button>
        </form>
      </div>

      <div className="product-list">
        <div
          style={{
            position: "fixed",
            zIndex: 1,
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            overflow: "auto",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            display: isModalOpen ? "block" : "none",
          }}
        >
          <div className="modal-content">
            <span onClick={() => setIsModalOpen(false)} className="close">
              &times;
            </span>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Title:</label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter product title"
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category:</label>
                <input
                  type="text"
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Enter product category"
                  required
                  className="form-control"
                  disabled
                />
              </div>

              <div className="form-group">
                <label htmlFor="sold">Sold:</label>
                <input
                  type="text"
                  id="sold"
                  value={sold}
                  onChange={(e) => setSold(e.target.value)}
                  placeholder="Units sold"
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="dimensions">Dimensions:</label>
                <input
                  type="text"
                  id="dimensions"
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  placeholder="Dimensions (e.g., 10x20 cm)"
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="price">Price:</label>
                <input
                  type="number"
                  id="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Price in USD"
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="profit">Profit:</label>
                <input
                  type="number"
                  id="profit"
                  value={profit}
                  onChange={(e) => setProfit(e.target.value)}
                  placeholder="Profit per unit"
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="productOnEbay">eBay Link:</label>
                <input
                  type="text"
                  id="productOnEbay"
                  value={productOnEbay}
                  onChange={(e) => setProductOnEbay(e.target.value)}
                  placeholder="URL to eBay listing"
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="source">Source:</label>
                <input
                  type="text"
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="URL to product source"
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="imageUrl">Image URL:</label>
                <input
                  type="text"
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="URL to product image"
                  required
                  className="form-control"
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </form>
          </div>
        </div>

        <h2>Products in {selectedCategory || "All Categories"}</h2>
        <ListingTable
          listings={products.filter(
            (product) =>
              !selectedCategory || product.Category === selectedCategory,
          )}
          onEditClick={handleEditClick}
          onDeleteClick={handleDelete}
        />
      </div>
    </>
  );
};

export default Dashboard;
