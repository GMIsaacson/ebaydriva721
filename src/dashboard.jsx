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
  serverTimestamp,
} from "firebase/firestore";
import Papa from "papaparse"; // For CSV/JSON parsing
import app from "./firebase-config"; // Firebase config
import "./dashboard.css";
import { useAuth } from "./AuthProvider"; // Authentication hook
import Csvtool from "./csvtool.jsx";

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
          <th>BEP</th>
          <th>Sell</th>
          <th>Buy</th>
          <th>Category</th>
          <th>SubCategory</th>
          <th>SubSubCategory</th>
          <th>Item</th>
          <th>Status</th>
          <th>Last Modified By</th>
          <th>Last Modified At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {listings.map((listing) => (
          <tr
            key={listing.id}
            className={listing.status === "Updated" ? "highlight-updated" : ""}
          >
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
            <td>${parseFloat(listing.BEP).toFixed(2)}</td>
            <td>
              <a href={listing.Sell} target="_blank" rel="noopener noreferrer">
                Sell Link
              </a>
            </td>
            <td>
              <a href={listing.Buy} target="_blank" rel="noopener noreferrer">
                Buy Link
              </a>
            </td>
            <td>{listing.Category}</td>
            <td>{listing.SubCategory}</td>
            <td>{listing.SubSubCategory}</td>
            <td>{listing.Item}</td>
            <td>{listing.status}</td>
            <td>{listing.lastModifiedBy}</td>
            <td>
              {listing.lastModifiedAt?.toDate().toLocaleString() || "N/A"}
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

// Main Dashboard component
const Dashboard = () => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [subSubCategory, setSubSubCategory] = useState("");
  const [item, setItem] = useState("");
  const [sold, setSold] = useState("");
  const [price, setPrice] = useState("");
  const [bep, setBep] = useState("");
  const [sell, setSell] = useState("");
  const [buy, setBuy] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [file, setFile] = useState(null); // For bulk upload file
  const [selectedIds, setSelectedIds] = useState([]); // Selected product IDs
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterValues, setFilterValues] = useState({
    title: "",
    category: "",
    subCategory: "",
    subSubCategory: "",
    priceMin: "",
    priceMax: "",
  });
  const [totalProducts, setTotalProducts] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [subSubCategories, setSubSubCategories] = useState([]);
  const [userActivities, setUserActivities] = useState([]);

  const { currentUser } = useAuth();
  const db = getFirestore(app);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const resetFormFields = () => {
    setTitle("");
    setCategory("");
    setSubCategory("");
    setSubSubCategory("");
    setItem("");
    setSold("");
    setPrice("");
    setBep("");
    setSell("");
    setBuy("");
    setDimensions("");
    setEditingProduct(null);
  };

  const resetFilters = () => {
    setFilterValues({
      title: "",
      category: "",
      subCategory: "",
      subSubCategory: "",
      priceMin: "",
      priceMax: "",
    });
  };

  const logUserActivity = async (action, productId) => {
    const activityRef = collection(db, "activities");
    await addDoc(activityRef, {
      userId: currentUser.uid,
      action,
      productId,
      timestamp: serverTimestamp(),
    });
  };

  const parseFile = async () => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log("Parsed Data:", results.data);
          resolve(results.data);
        },
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
      const validProducts = data.filter((product) => {
        const isValid =
          product.title &&
          product.sold &&
          product.price &&
          product.bep &&
          product.dimension &&
          product.sell &&
          product.buy &&
          product.category &&
          product.subCategory &&
          product.subSubCategory &&
          product.item;

        if (!isValid) {
          console.log("Invalid product:", product);
        }

        return isValid;
      });

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
          Price: parseFloat(product.price),
          BEP: parseFloat(product.bep),
          Dimensions: product.dimension,
          Sell: product.sell,
          Buy: product.buy,
          Category: product.category,
          SubCategory: product.subCategory,
          SubSubCategory: product.subSubCategory,
          Item: product.item,
          status: "New",
          lastModifiedBy: currentUser.email,
          lastModifiedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      // Fetch the updated products list
      fetchProducts();
      alert("Bulk upload successful!");
      logUserActivity("Bulk upload", "multiple");
    } catch (error) {
      console.error("Error during bulk upload:", error);
      alert("Bulk upload failed. Please try again.");
    }
  };

  const handleBulkDelete = async (idsToDelete) => {
    if (idsToDelete.length === 0) {
      alert("No products selected for deletion.");
      return;
    }

    try {
      const batch = writeBatch(db);
      idsToDelete.forEach((id) => {
        const docRef = doc(db, "products", id);
        batch.delete(docRef);
      });

      await batch.commit();

      // Update the products state to remove the deleted products
      setProducts((prevProducts) =>
        prevProducts.filter((product) => !idsToDelete.includes(product.id))
      );
      // Clear selectedIds
      setSelectedIds([]);

      alert("Selected products deleted successfully!");
      logUserActivity("Bulk delete", "multiple");
    } catch (error) {
      console.error("Error deleting selected products:", error);
      alert("Error deleting selected products!");
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
          Sold: sold,
          Price: parseFloat(price),
          BEP: parseFloat(bep),
          Sell: sell,
          Buy: buy,
          Dimensions: dimensions,
          Category: category,
          SubCategory: subCategory,
          SubSubCategory: subSubCategory,
          Item: item,
          status: "Updated",
          lastModifiedBy: currentUser.email,
          lastModifiedAt: serverTimestamp(),
        });
        alert("Product updated successfully!");
        logUserActivity("Update product", editingProduct.id);
      } else {
        // Add new product
        await addDoc(collection(db, "products"), {
          Title: title,
          Sold: sold,
          Price: parseFloat(price),
          BEP: parseFloat(bep),
          Sell: sell,
          Buy: buy,
          Dimensions: dimensions,
          Category: category,
          SubCategory: subCategory,
          SubSubCategory: subSubCategory,
          Item: item,
          status: "New",
          lastModifiedBy: currentUser.email,
          lastModifiedAt: serverTimestamp(),
        });
        alert("Product added successfully!");
        logUserActivity("Add product", "new");
      }

      resetFormFields();
      // Fetch the updated products list
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error saving product!");
    }
  };

  const fetchProducts = async () => {
    const productsCollection = collection(db, "products");
    const productSnapshot = await getDocs(productsCollection);
    const productList = productSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setTotalProducts(productList.length);

    // Extract unique categories, subcategories, and subsubcategories
    const uniqueCategories = [
      ...new Set(productList.map((product) => product.Category)),
    ];
    const uniqueSubCategories = [
      ...new Set(productList.map((product) => product.SubCategory)),
    ];
    const uniqueSubSubCategories = [
      ...new Set(productList.map((product) => product.SubSubCategory)),
    ];
    setCategories(uniqueCategories);
    setSubCategories(uniqueSubCategories);
    setSubSubCategories(uniqueSubSubCategories);

    // Apply filtering
    let filteredProducts = productList.filter((product) => {
      return (
        (filterValues.title === "" ||
          product.Title.toLowerCase().includes(
            filterValues.title.toLowerCase()
          )) &&
        (filterValues.category === "" ||
          product.Category?.toLowerCase().includes(
            filterValues.category.toLowerCase()
          )) &&
        (filterValues.subCategory === "" ||
          product.SubCategory?.toLowerCase().includes(
            filterValues.subCategory.toLowerCase()
          )) &&
        (filterValues.subSubCategory === "" ||
          product.SubSubCategory?.toLowerCase().includes(
            filterValues.subSubCategory.toLowerCase()
          )) &&
        (filterValues.priceMin === "" ||
          parseFloat(product.Price) >= parseFloat(filterValues.priceMin)) &&
        (filterValues.priceMax === "" ||
          parseFloat(product.Price) <= parseFloat(filterValues.priceMax))
      );
    });

    setFilteredTotal(filteredProducts.length);

    // Apply sorting
    if (sortField) {
      filteredProducts.sort((a, b) => {
        if (sortOrder === "asc") {
          return a[sortField] > b[sortField] ? 1 : -1;
        } else {
          return a[sortField] < b[sortField] ? 1 : -1;
        }
      });
    }

    setProducts(filteredProducts);
  };

  useEffect(() => {
    fetchProducts();

    const fetchUserActivities = async () => {
      const activitiesCollection = collection(db, "activities");
      const activitySnapshot = await getDocs(activitiesCollection);
      const activityList = activitySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((activity) => activity.userId === currentUser.uid)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
      setUserActivities(activityList);
    };

    fetchUserActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValues, sortField, sortOrder]);

  return (
    <>
      <Csvtool />
      <div className="filter-sort-controls">
        <h3>Filter Products</h3>
        <select
          value={filterValues.category}
          onChange={(e) =>
            setFilterValues((prev) => ({ ...prev, category: e.target.value }))
          }
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={filterValues.subCategory}
          onChange={(e) =>
            setFilterValues((prev) => ({
              ...prev,
              subCategory: e.target.value,
            }))
          }
        >
          <option value="">All SubCategories</option>
          {subCategories.map((subCat) => (
            <option key={subCat} value={subCat}>
              {subCat}
            </option>
          ))}
        </select>
        <select
          value={filterValues.subSubCategory}
          onChange={(e) =>
            setFilterValues((prev) => ({
              ...prev,
              subSubCategory: e.target.value,
            }))
          }
        >
          <option value="">All SubSubCategories</option>
          {subSubCategories.map((subSubCat) => (
            <option key={subSubCat} value={subSubCat}>
              {subSubCat}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by Title"
          value={filterValues.title}
          onChange={(e) =>
            setFilterValues((prev) => ({ ...prev, title: e.target.value }))
          }
        />
        <input
          type="number"
          placeholder="Min Price"
          value={filterValues.priceMin}
          onChange={(e) =>
            setFilterValues((prev) => ({ ...prev, priceMin: e.target.value }))
          }
        />
        <input
          type="number"
          placeholder="Max Price"
          value={filterValues.priceMax}
          onChange={(e) =>
            setFilterValues((prev) => ({ ...prev, priceMax: e.target.value }))
          }
        />
        <button onClick={resetFilters}>Reset Filters</button>

        <h3>Sort Products</h3>
        <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
          <option value="">Select Field</option>
          <option value="Title">Title</option>
          <option value="Price">Price</option>
          <option value="Sold">Sold</option>
          <option value="BEP">BEP</option>
          {/* Note: Sell and Buy are strings; sorting numerically might not be appropriate */}
        </select>

        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
      <div>
        <h1>Bulk Upload</h1>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          accept=".csv, .json"
        />
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
            value={subSubCategory}
            onChange={(e) => setSubSubCategory(e.target.value)}
            placeholder="SubSubCategory"
            required
          />
          <input
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Item"
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
              value={bep}
              onChange={(e) => setBep(e.target.value)}
              placeholder="BEP"
              required
            />
            <input
              type="text"
              value={sell}
              onChange={(e) => setSell(e.target.value)}
              placeholder="Sell (e.g., Sell Link)"
              required
            />
            <input
              type="text"
              value={buy}
              onChange={(e) => setBuy(e.target.value)}
              placeholder="Buy (e.g., Buy Link)"
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
          <button type="submit">
            {editingProduct ? "Update Product" : "Add Product"}
          </button>
        </form>
      </div>
      <div className="product-list">
        <h2>
          Products (Total: {totalProducts}, Showing: {filteredTotal})
        </h2>
        <ListingTable
          listings={products}
          onEditClick={(product) => {
            setEditingProduct(product);
            setTitle(product.Title);
            setSold(product.Sold);
            setPrice(product.Price);
            setBep(product.BEP);
            setSell(product.Sell);
            setBuy(product.Buy);
            setDimensions(product.Dimensions);
            setCategory(product.Category);
            setSubCategory(product.SubCategory);
            setSubSubCategory(product.SubSubCategory);
            setItem(product.Item);
            setIsModalOpen(true);
          }}
          onDeleteClick={(id) => {
            const productRef = doc(db, "products", id);
            deleteDoc(productRef).then(() => {
              setProducts(products.filter((product) => product.id !== id));
              alert("Product deleted successfully!");
              logUserActivity("Delete product", id);
            });
          }}
          selectedIds={selectedIds}
          onSelectChange={(checked, id) => {
            if (id === "all") {
              setSelectedIds(checked ? products.map((product) => product.id) : []);
            } else {
              setSelectedIds((prevIds) =>
                checked
                  ? [...prevIds, id]
                  : prevIds.filter((productId) => productId !== id)
              );
            }
          }}
        />
      </div>
      <button onClick={() => handleBulkDelete(selectedIds)}>
        Delete Selected Products
      </button>
      <div className="user-activity">
        <h3>Your Recent Activities</h3>
        <ul>
          {userActivities.map((activity) => (
            <li key={activity.id}>
              {activity.action} - {activity.productId} -{" "}
              {activity.timestamp?.toDate().toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Confirm Bulk Deletion</h2>
            <p>
              Are you sure you want to delete {selectedIds.length} selected
              product(s)? This action cannot be undone.
            </p>
            <p>
              Please type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
            />
            <div className="modal-buttons">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmationText("");
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmationText === "DELETE") {
                    handleBulkDelete(selectedIds);
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmationText("");
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














