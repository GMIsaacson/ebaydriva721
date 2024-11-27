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
import Papa from "papaparse"; // For CSV/JSON parsing
import app from "./firebase-config"; // Firebase config
import "./dashboard.css";
import { useAuth } from "./AuthProvider"; // Authentication hook
import Csvtool from "./csvtool.jsx";
import { categoryTree } from "./categoryData"; // Categories data
import AccountPage from "./accountspage.jsx";

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
          <th>Source</th>
          <th>Category</th>
          <th>SubCategory</th>
          <th>Item</th>
          <th>SubSubCategory</th>
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
            <td>{listing.Category}</td>
            <td>{listing.SubCategory}</td>
            <td>{listing.Item}</td>
            <td>{listing.SubSubCategory}</td>
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

// Main Dashboard component
const Dashboard = () => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [item, setItem] = useState("");
  const [subSubCategory, setSubSubCategory] = useState("");
  const [sold, setSold] = useState("");
  const [productOnEbay, setProductOnEbay] = useState("");
  const [source, setSource] = useState("");
  const [price, setPrice] = useState("");
  const [profit, setProfit] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [file, setFile] = useState(null); // For bulk upload file
  const [selectedIds, setSelectedIds] = useState([]); // Selected product IDs

  const { currentUser, logout } = useAuth();
  const db = getFirestore(app);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  
  const resetFormFields = () => {
    setTitle("");
    setCategory("");
    setSubCategory("");
    setItem("");
    setSubSubCategory("");
    setSold("");
    setProductOnEbay("");
    setSource("");
    setPrice("");
    setProfit("");
    setDimensions("");
    setEditingProduct(null);
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

      // Validate products with all required fields
      const validProducts = data.filter(
        (product) =>
          product.title &&
          product.sold &&
          product.price &&
          product.profit &&
          product.category &&
          product.subCategory &&
          product.item &&
          product.subSubCategory
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
          Dimensions: product.dimension,
          Category: product.category,
          SubCategory: product.subCategory,
          Item: product.item,
          SubSubCategory: product.subSubCategory,
        });
      });

      await batch.commit();
      setProducts((prev) => [...prev, ...validProducts]);
      alert("Bulk upload successful!");
    } catch (error) {
      console.error("Error during bulk upload:", error);
      alert("Bulk upload failed. Please try again.");
    }
  };

  
  const handleBulkDelete = async (idsToDelete) => {
    if (idsToDelete.length === 0) {
      alert('No products selected for deletion.');
      return;
    }

    try {
      const batch = writeBatch(db);
      idsToDelete.forEach((id) => {
        const docRef = doc(db, 'products', id);
        batch.delete(docRef);
      });

      await batch.commit();

      // Update the products state to remove the deleted products
      setProducts((prevProducts) =>
        prevProducts.filter((product) => !idsToDelete.includes(product.id))
      );
      // Clear selectedIds
      setSelectedIds([]);

      alert('Selected products deleted successfully!');
    } catch (error) {
      console.error('Error deleting selected products:', error);
      alert('Error deleting selected products!');
    }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingProduct) {
        // Update product
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, {
          Title: title,
          Category: category,
          SubCategory: subCategory,
          Item: item,
          SubSubCategory: subSubCategory,
          Sold: sold,
          ProductOnEbay: productOnEbay,
          Source: source,
          Price: parseFloat(price),
          Profit: parseFloat(profit),
          Dimensions: dimensions,
        });
        alert("Product updated successfully!");
      } else {
        // Add new product
        await addDoc(collection(db, "products"), {
          Title: title,
          Category: category,
          SubCategory: subCategory,
          Item: item,
          SubSubCategory: subSubCategory,
          Sold: sold,
          ProductOnEbay: productOnEbay,
          Source: source,
          Price: parseFloat(price),
          Profit: parseFloat(profit),
          Dimensions: dimensions,
        });
        alert("Product added successfully!");
      }

      setIsModalOpen(false);
      resetFormFields();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error saving product!");
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
      <Csvtool />
      <div>
        <h1>Bulk Upload</h1>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} accept=".csv, .json" />
        <button onClick={handleBulkUpload}>Upload Products</button>
      </div>
      <div className="addproduct-dashboard">
        <h1>Add Single Product</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            required
          />
          <input
            type="text"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            placeholder="SubCategory"
            required
          />
          <input
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Item"
            required
          />
          <input
            type="text"
            value={subSubCategory}
            onChange={(e) => setSubSubCategory(e.target.value)}
            placeholder="SubSubCategory"
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
      <div className="product-list">
        <h2>Products</h2>
        <ListingTable
          listings={products}
          onEditClick={(product) => {
            setEditingProduct(product);
            setTitle(product.Title);
            setCategory(product.Category);
            setSubCategory(product.SubCategory);
            setItem(product.Item);
            setSubSubCategory(product.SubSubCategory);
            setSold(product.Sold);
            setProductOnEbay(product.ProductOnEbay);
            setSource(product.Source);
            setPrice(product.Price);
            setProfit(product.Profit);
            setDimensions(product.Dimensions);
            setIsModalOpen(true);
          }}
          onDeleteClick={(id) => {
            const productRef = doc(db, "products", id);
            deleteDoc(productRef).then(() => {
              setProducts(products.filter((product) => product.id !== id));
              alert("Product deleted successfully!");
            });
          }}
          selectedIds={selectedIds}
          onSelectChange={(checked, id) => {
            if (id === "all") {
              setSelectedIds(checked ? products.map((product) => product.id) : []);
            } else {
              setSelectedIds((prevIds) =>
                checked ? [...prevIds, id] : prevIds.filter((productId) => productId !== id)
              );
            }
          }}
        />
      </div>
      <button onClick={() => handleBulkDelete(selectedIds)}>Delete Selected Products</button>
           {/* Delete Confirmation Modal */}
           {isDeleteModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Confirm Bulk Deletion</h2>
            <p>
              Are you sure you want to delete {selectedIds.length} selected product(s)? This action cannot be undone.
            </p>
            <p>Please type <strong>DELETE</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
            />
            <div className="modal-buttons">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmationText('');
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmationText === 'DELETE') {
                    handleBulkDelete(selectedIds);
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmationText('');
                  } else {
                    alert('Please type "DELETE" to confirm.');
                  }
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
    </>
  );
};

export default Dashboard;





