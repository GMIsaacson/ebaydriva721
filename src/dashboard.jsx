import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import Papa from "papaparse";
import app from "./firebase-config";
import { useAuth } from "./AuthProvider";
import Csvtool from "./csvtool.jsx";
import "./dashboard.css";

const emptyProduct = {
  title: "", category: "", subCategory: "", subSubCategory: "", item: "",
  sold: "", price: "", bep: "", sell: "", buy: "", dimensions: "",
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "N/A";
  try {
    if (typeof timestamp.toDate === "function") return timestamp.toDate().toLocaleString();
    if (timestamp instanceof Date) return timestamp.toLocaleString();
    return "N/A";
  } catch {
    return "N/A";
  }
};

const Dashboard = () => {
  const { currentUser } = useAuth();
  const db = getFirestore(app);

  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [filters, setFilters] = useState({ title: "", category: "", subCategory: "", subSubCategory: "", priceMin: "", priceMax: "" });
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  const loadProducts = async () => {
    const snapshot = await getDocs(collection(db, "products"));
    setProducts(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
  };

  const loadActivities = async () => {
    if (!currentUser) return;
    const snapshot = await getDocs(collection(db, "activities"));
    const rows = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .filter((activity) => activity.userId === currentUser.uid)
      .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
      .slice(0, 5);
    setActivities(rows);
  };

  useEffect(() => {
    let active = true;
    Promise.all([loadProducts(), loadActivities()]).catch((error) => {
      console.error("Dashboard load failed:", error);
      if (active) setNotice("Some dashboard data could not be loaded.");
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const logActivity = async (action, productId) => {
    if (!currentUser) return;
    await addDoc(collection(db, "activities"), {
      userId: currentUser.uid,
      action,
      productId,
      timestamp: serverTimestamp(),
    });
    await loadActivities();
  };

  const categories = useMemo(() => [...new Set(products.map((p) => p.Category).filter(Boolean))].sort(), [products]);
  const subCategories = useMemo(() => [...new Set(products.filter((p) => !filters.category || p.Category === filters.category).map((p) => p.SubCategory).filter(Boolean))].sort(), [products, filters.category]);
  const subSubCategories = useMemo(() => [...new Set(products.filter((p) => (!filters.category || p.Category === filters.category) && (!filters.subCategory || p.SubCategory === filters.subCategory)).map((p) => p.SubSubCategory).filter(Boolean))].sort(), [products, filters.category, filters.subCategory]);

  const filteredProducts = useMemo(() => {
    let rows = products.filter((product) => {
      const title = String(product.Title || "").toLowerCase();
      if (filters.title && !title.includes(filters.title.toLowerCase())) return false;
      if (filters.category && product.Category !== filters.category) return false;
      if (filters.subCategory && product.SubCategory !== filters.subCategory) return false;
      if (filters.subSubCategory && product.SubSubCategory !== filters.subSubCategory) return false;
      if (filters.priceMin !== "" && Number(product.Price) < Number(filters.priceMin)) return false;
      if (filters.priceMax !== "" && Number(product.Price) > Number(filters.priceMax)) return false;
      return true;
    });
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const numeric = ["Price", "BEP", "Sold"].includes(sortField);
        const comparison = numeric
          ? (Number(a[sortField]) || 0) - (Number(b[sortField]) || 0)
          : String(a[sortField] || "").localeCompare(String(b[sortField] || ""));
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }
    return rows;
  }, [products, filters, sortField, sortOrder]);

  const resetFilters = () => {
    setFilters({ title: "", category: "", subCategory: "", subSubCategory: "", priceMin: "", priceMax: "" });
    setSortField("");
    setSortOrder("asc");
  };

  const updateForm = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));
  const resetForm = () => { setForm(emptyProduct); setEditingProduct(null); };

  const saveProduct = async (event) => {
    event.preventDefault();
    if (!currentUser) return;
    setBusy(true);
    setNotice("");
    const payload = {
      Title: form.title.trim(),
      Category: form.category.trim(),
      SubCategory: form.subCategory.trim(),
      SubSubCategory: form.subSubCategory.trim(),
      Item: form.item.trim(),
      Sold: form.sold,
      Price: Number(form.price),
      BEP: Number(form.bep),
      Sell: form.sell.trim(),
      Buy: form.buy.trim(),
      Dimensions: form.dimensions.trim(),
      status: editingProduct ? "Updated" : "New",
      lastModifiedBy: currentUser.email,
      lastModifiedAt: serverTimestamp(),
    };
    try {
      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), payload);
        await logActivity("Update product", editingProduct.id);
        setNotice("Product updated.");
      } else {
        const created = await addDoc(collection(db, "products"), payload);
        await logActivity("Add product", created.id);
        setNotice("Product added.");
      }
      resetForm();
      await loadProducts();
    } catch (error) {
      console.error("Product save failed:", error);
      setNotice("Product could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setForm({
      title: product.Title || "", category: product.Category || "", subCategory: product.SubCategory || "",
      subSubCategory: product.SubSubCategory || "", item: product.Item || "", sold: product.Sold ?? "",
      price: product.Price ?? "", bep: product.BEP ?? "", sell: product.Sell || "", buy: product.Buy || "",
      dimensions: product.Dimensions || "",
    });
    document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deleteSingle = async (product) => {
    if (!window.confirm(`Delete “${product.Title || "this product"}”? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "products", product.id));
      await logActivity("Delete product", product.id);
      setSelectedIds((ids) => ids.filter((id) => id !== product.id));
      await loadProducts();
      setNotice("Product deleted.");
    } catch (error) {
      console.error("Delete failed:", error);
      setNotice("Product could not be deleted.");
    }
  };

  const parseUpload = () => new Promise((resolve, reject) => {
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => resolve(results.data), error: reject });
  });

  const bulkUpload = async () => {
    if (!file || !currentUser) { setNotice("Choose a CSV file first."); return; }
    setBusy(true);
    try {
      const rows = await parseUpload();
      const validRows = rows.filter((product) => product.title && product.sold && product.price && product.bep && product.dimension && product.sell && product.buy && product.category && product.subCategory && product.subSubCategory && product.item);
      if (!validRows.length) { setNotice("No valid products were found in that file."); return; }
      const batch = writeBatch(db);
      const productsRef = collection(db, "products");
      validRows.forEach((product) => {
        batch.set(doc(productsRef), {
          Title: product.title, Sold: product.sold, Price: Number(product.price), BEP: Number(product.bep),
          Dimensions: product.dimension, Sell: product.sell, Buy: product.buy, Category: product.category,
          SubCategory: product.subCategory, SubSubCategory: product.subSubCategory, Item: product.item,
          status: "New", lastModifiedBy: currentUser.email, lastModifiedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      await logActivity("Bulk upload", `${validRows.length} products`);
      await loadProducts();
      setFile(null);
      setNotice(`${validRows.length} products uploaded.`);
    } catch (error) {
      console.error("Bulk upload failed:", error);
      setNotice("Bulk upload failed. Check the file and try again.");
    } finally {
      setBusy(false);
    }
  };

  const openBulkDelete = () => {
    if (!selectedIds.length) { setNotice("Select at least one product first."); return; }
    setDeleteConfirmationText("");
    setDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (deleteConfirmationText !== "DELETE") return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => batch.delete(doc(db, "products", id)));
      await batch.commit();
      await logActivity("Bulk delete", `${selectedIds.length} products`);
      setSelectedIds([]);
      setDeleteModalOpen(false);
      setDeleteConfirmationText("");
      await loadProducts();
      setNotice("Selected products deleted.");
    } catch (error) {
      console.error("Bulk delete failed:", error);
      setNotice("Selected products could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id));
  const toggleAllVisible = (checked) => {
    const visibleIds = filteredProducts.map((product) => product.id);
    setSelectedIds((previous) => checked ? [...new Set([...previous, ...visibleIds])] : previous.filter((id) => !visibleIds.includes(id)));
  };

  return (
    <main className="ds-page ds-dashboard">
      <header className="ds-dashboard-header">
        <div>
          <p className="ds-dashboard-eyebrow">OPERATIONS</p>
          <h1>DataScout dashboard</h1>
          <p>Manage the sourcing database, imports, and recent changes from one workspace.</p>
        </div>
        <button className="ds-button ds-button-primary" type="button" onClick={() => document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth" })}>+ Add product</button>
      </header>

      <section className="ds-kpi-grid" aria-label="Dashboard summary">
        <div className="ds-kpi"><span className="ds-kpi-label">Total products</span><strong className="ds-kpi-value">{products.length}</strong></div>
        <div className="ds-kpi"><span className="ds-kpi-label">Current matches</span><strong className="ds-kpi-value">{filteredProducts.length}</strong></div>
        <div className="ds-kpi"><span className="ds-kpi-label">Selected</span><strong className="ds-kpi-value">{selectedIds.length}</strong></div>
        <div className="ds-kpi"><span className="ds-kpi-label">Recent activity</span><strong className="ds-kpi-value">{activities.length}</strong></div>
      </section>

      {notice && <div className="ds-dashboard-notice" role="status">{notice}</div>}

      <section className="ds-panel ds-dashboard-panel">
        <div className="ds-panel-heading">
          <div><h2 className="ds-section-title">Find products</h2><p className="ds-section-copy">Filter and sort the working catalog before taking bulk actions.</p></div>
          <button className="ds-button ds-button-secondary" type="button" onClick={resetFilters}>Reset</button>
        </div>
        <div className="ds-dashboard-filter-grid">
          <label><span>Title</span><input value={filters.title} onChange={(e) => setFilters((p) => ({ ...p, title: e.target.value }))} placeholder="Search title..." /></label>
          <label><span>Category</span><select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value, subCategory: "", subSubCategory: "" }))}><option value="">All categories</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Subcategory</span><select value={filters.subCategory} onChange={(e) => setFilters((p) => ({ ...p, subCategory: e.target.value, subSubCategory: "" }))}><option value="">All subcategories</option>{subCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Sub-subcategory</span><select value={filters.subSubCategory} onChange={(e) => setFilters((p) => ({ ...p, subSubCategory: e.target.value }))}><option value="">All</option>{subSubCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Min price</span><input type="number" value={filters.priceMin} onChange={(e) => setFilters((p) => ({ ...p, priceMin: e.target.value }))} placeholder="$0" /></label>
          <label><span>Max price</span><input type="number" value={filters.priceMax} onChange={(e) => setFilters((p) => ({ ...p, priceMax: e.target.value }))} placeholder="Any" /></label>
          <label><span>Sort field</span><select value={sortField} onChange={(e) => setSortField(e.target.value)}><option value="">Default</option><option value="Title">Title</option><option value="Price">Price</option><option value="Sold">Sold</option><option value="BEP">BEP</option></select></label>
          <label><span>Direction</span><select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
        </div>
      </section>

      <section className="ds-panel ds-dashboard-panel ds-catalog-panel">
        <div className="ds-panel-heading ds-catalog-heading">
          <div><h2 className="ds-section-title">Product catalog</h2><p className="ds-section-copy">{filteredProducts.length} shown of {products.length}. Table scrolls horizontally on smaller screens.</p></div>
          <div className="ds-catalog-actions">
            <span>{selectedIds.length} selected</span>
            <button className="ds-button ds-button-danger" type="button" disabled={!selectedIds.length} onClick={openBulkDelete}>Delete selected</button>
          </div>
        </div>
        <div className="ds-dashboard-table-wrap">
          <table className="ds-dashboard-table">
            <thead><tr>
              <th><input aria-label="Select all visible products" type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleAllVisible(e.target.checked)} /></th>
              <th>Title</th><th>Sold</th><th>Price</th><th>BEP</th><th>Category</th><th>Subcategory</th><th>Item</th><th>Status</th><th>Modified</th><th>Links</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className={product.status === "Updated" ? "updated" : ""}>
                  <td><input aria-label={`Select ${product.Title || "product"}`} type="checkbox" checked={selectedIds.includes(product.id)} onChange={(e) => setSelectedIds((ids) => e.target.checked ? [...new Set([...ids, product.id])] : ids.filter((id) => id !== product.id))} /></td>
                  <td className="ds-title-cell">{product.Title || "Untitled"}</td>
                  <td>{product.Sold ?? "N/A"}</td>
                  <td>{Number.isFinite(Number(product.Price)) ? `$${Number(product.Price).toFixed(2)}` : "N/A"}</td>
                  <td>{Number.isFinite(Number(product.BEP)) ? `$${Number(product.BEP).toFixed(2)}` : "N/A"}</td>
                  <td>{product.Category || "N/A"}</td>
                  <td>{product.SubCategory || "N/A"}</td>
                  <td>{product.Item || product.SubSubCategory || "N/A"}</td>
                  <td><span className={`ds-status ${product.status === "Updated" ? "updated" : "new"}`}>{product.status || "N/A"}</span></td>
                  <td><span className="ds-modified-by">{product.lastModifiedBy || "N/A"}</span><small>{formatTimestamp(product.lastModifiedAt)}</small></td>
                  <td><div className="ds-table-links">{product.Sell && <a href={product.Sell} target="_blank" rel="noopener noreferrer">Sell ↗</a>}{product.Buy && <a href={product.Buy} target="_blank" rel="noopener noreferrer">Buy ↗</a>}</div></td>
                  <td><div className="ds-row-actions"><button type="button" onClick={() => startEdit(product)}>Edit</button><button type="button" className="danger" onClick={() => deleteSingle(product)}>Delete</button></div></td>
                </tr>
              ))}
              {!filteredProducts.length && <tr><td colSpan="12"><div className="ds-empty">No products match these filters.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section id="product-editor" className="ds-panel ds-dashboard-panel ds-editor-panel">
        <div className="ds-panel-heading">
          <div><h2 className="ds-section-title">{editingProduct ? "Edit product" : "Add product"}</h2><p className="ds-section-copy">Keep the sourcing record consistent with the DataScout product schema.</p></div>
          {editingProduct && <button className="ds-button ds-button-secondary" type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
        <form className="ds-product-form" onSubmit={saveProduct}>
          <label className="wide"><span>Title</span><input required value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="Product title" /></label>
          <label><span>Category</span><input required value={form.category} onChange={(e) => updateForm("category", e.target.value)} /></label>
          <label><span>Subcategory</span><input required value={form.subCategory} onChange={(e) => updateForm("subCategory", e.target.value)} /></label>
          <label><span>Sub-subcategory</span><input required value={form.subSubCategory} onChange={(e) => updateForm("subSubCategory", e.target.value)} /></label>
          <label><span>Item</span><input required value={form.item} onChange={(e) => updateForm("item", e.target.value)} /></label>
          <label><span>Sold</span><input required value={form.sold} onChange={(e) => updateForm("sold", e.target.value)} /></label>
          <label><span>Price</span><input required type="number" step="0.01" value={form.price} onChange={(e) => updateForm("price", e.target.value)} /></label>
          <label><span>BEP</span><input required type="number" step="0.01" value={form.bep} onChange={(e) => updateForm("bep", e.target.value)} /></label>
          <label><span>Dimensions</span><input required value={form.dimensions} onChange={(e) => updateForm("dimensions", e.target.value)} /></label>
          <label className="wide"><span>Sell evidence URL</span><input required type="url" value={form.sell} onChange={(e) => updateForm("sell", e.target.value)} placeholder="https://..." /></label>
          <label className="wide"><span>Buy source URL</span><input required type="url" value={form.buy} onChange={(e) => updateForm("buy", e.target.value)} placeholder="https://..." /></label>
          <div className="ds-form-actions wide"><button className="ds-button ds-button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : editingProduct ? "Update product" : "Add product"}</button></div>
        </form>
      </section>

      <section className="ds-panel ds-dashboard-panel ds-tools-panel">
        <div className="ds-panel-heading">
          <div><h2 className="ds-section-title">Import & export tools</h2><p className="ds-section-copy">Secondary workflows stay available without competing with the daily catalog view.</p></div>
          <button className="ds-button ds-button-secondary" type="button" onClick={() => setShowTools((value) => !value)}>{showTools ? "Hide tools" : "Open tools"}</button>
        </div>
        {showTools && (
          <div className="ds-tools-grid">
            <div className="ds-tool-card"><h3>Bulk upload</h3><p>Import products using the established DataScout CSV schema.</p><input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} /><button className="ds-button ds-button-primary" type="button" disabled={busy || !file} onClick={bulkUpload}>Upload CSV</button></div>
            <div className="ds-tool-card ds-csv-tool"><h3>CSV Builder</h3><p>Build and export structured product rows.</p><Csvtool /></div>
          </div>
        )}
      </section>

      <section className="ds-panel ds-dashboard-panel">
        <div className="ds-panel-heading"><div><h2 className="ds-section-title">Recent activity</h2><p className="ds-section-copy">Your five most recent DataScout database actions.</p></div></div>
        <ul className="ds-activity-list">
          {activities.map((activity) => <li key={activity.id}><span className="ds-activity-dot" /><div><strong>{activity.action}</strong><p>{activity.productId}</p></div><time>{formatTimestamp(activity.timestamp)}</time></li>)}
          {!activities.length && <li className="ds-empty">No recent activity yet.</li>}
        </ul>
      </section>

      {deleteModalOpen && (
        <div className="ds-confirm-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteModalOpen(false); }}>
          <div className="ds-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-delete-title">
            <h2 id="bulk-delete-title">Delete {selectedIds.length} products?</h2>
            <p>This permanently removes the selected records. Type <strong>DELETE</strong> to confirm.</p>
            <input autoFocus value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} placeholder="DELETE" />
            <div className="ds-confirm-actions"><button className="ds-button ds-button-secondary" type="button" onClick={() => setDeleteModalOpen(false)}>Cancel</button><button className="ds-button ds-button-danger" type="button" disabled={deleteConfirmationText !== "DELETE" || busy} onClick={confirmBulkDelete}>{busy ? "Deleting…" : "Delete products"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
