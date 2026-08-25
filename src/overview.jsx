import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import {
  FaArrowRight,
  FaChartLine,
  FaCheckCircle,
  FaDatabase,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaLayerGroup,
  FaLink,
} from "react-icons/fa";
import app from "./firebase-config";
import { useAuth } from "./AuthProvider";
import "./overview.css";

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const timestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
};

const formatTime = (value) => {
  const millis = timestampMillis(value);
  if (!millis) return "No timestamp";
  return new Date(millis).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const money = (value) => {
  const parsed = numberValue(value);
  return parsed === null ? "—" : `$${parsed.toFixed(2)}`;
};

const Overview = () => {
  const { currentUser } = useAuth();
  const db = getFirestore(app);
  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [productSnapshot, activitySnapshot] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "activities")),
        ]);

        if (cancelled) return;

        setProducts(productSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        setActivities(
          activitySnapshot.docs
            .map((document) => ({ id: document.id, ...document.data() }))
            .filter((activity) => !currentUser || activity.userId === currentUser.uid)
            .sort((a, b) => timestampMillis(b.timestamp) - timestampMillis(a.timestamp))
            .slice(0, 5)
        );
      } catch (loadError) {
        console.error("Overview load failed:", loadError);
        if (!cancelled) setError("DataScout intelligence could not be loaded right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [db, currentUser?.uid]);

  const intelligence = useMemo(() => {
    const total = products.length;
    const evidenceComplete = products.filter((product) => product.Sell && product.Buy).length;
    const demand50 = products.filter((product) => (numberValue(product.Sold) || 0) >= 50).length;

    const spreads = products
      .map((product) => {
        const price = numberValue(product.Price);
        const bep = numberValue(product.BEP);
        return price === null || bep === null ? null : price - bep;
      })
      .filter((value) => value !== null);

    const averageSpread = spreads.length
      ? spreads.reduce((sum, value) => sum + value, 0) / spreads.length
      : null;

    const topDemand = [...products]
      .sort((a, b) => (numberValue(b.Sold) || 0) - (numberValue(a.Sold) || 0))
      .slice(0, 6);

    const categoryCounts = products.reduce((accumulator, product) => {
      const category = product.Category || "Uncategorized";
      accumulator[category] = (accumulator[category] || 0) + 1;
      return accumulator;
    }, {});

    const categories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const attention = [...products]
      .filter((product) => !product.Sell || !product.Buy)
      .sort((a, b) => (numberValue(b.Sold) || 0) - (numberValue(a.Sold) || 0))
      .slice(0, 5);

    const recentRecords = [...products]
      .filter((product) => timestampMillis(product.lastModifiedAt))
      .sort((a, b) => timestampMillis(b.lastModifiedAt) - timestampMillis(a.lastModifiedAt))
      .slice(0, 5);

    const latestModified = recentRecords[0]?.lastModifiedAt || null;

    return {
      total,
      evidenceComplete,
      evidencePercent: total ? Math.round((evidenceComplete / total) * 100) : 0,
      demand50,
      averageSpread,
      topDemand,
      categories,
      attention,
      recentRecords,
      latestModified,
    };
  }, [products]);

  const maxCategoryCount = intelligence.categories[0]?.count || 1;

  return (
    <main className="ds-overview-page">
      <header className="ds-overview-header">
        <div>
          <p className="ds-overview-eyebrow">INTELLIGENCE OVERVIEW</p>
          <h1>What deserves attention now</h1>
          <p>Demand, evidence readiness, category concentration and recent research activity from the current DataScout catalog.</p>
          <div className="ds-overview-refresh">
            <span className="ds-overview-live-dot" />
            {intelligence.latestModified ? `Catalog last changed ${formatTime(intelligence.latestModified)}` : "Catalog intelligence ready"}
          </div>
        </div>
        <div className="ds-overview-header-actions">
          <Link className="ds-button ds-button-primary" to="/products">Browse opportunities <FaArrowRight /></Link>
          <Link className="ds-button ds-button-secondary" to="/catalog-admin">Catalog admin</Link>
        </div>
      </header>

      {error && (
        <section className="ds-overview-error" role="alert">
          <FaExclamationTriangle />
          <div><strong>Overview unavailable</strong><span>{error}</span></div>
        </section>
      )}

      {loading ? (
        <section className="ds-overview-skeleton-grid" aria-label="Loading intelligence overview">
          {[0, 1, 2, 3].map((item) => <div className="ds-overview-skeleton-card" key={item}><i /><i /><i /></div>)}
        </section>
      ) : !error && (
        <>
          <section className="ds-overview-metrics" aria-label="Intelligence summary">
            <article className="ds-overview-metric">
              <div className="ds-overview-metric-top"><span>Catalog coverage</span><FaDatabase /></div>
              <strong>{intelligence.total.toLocaleString()}</strong>
              <p>opportunities in the working catalog</p>
            </article>
            <article className="ds-overview-metric">
              <div className="ds-overview-metric-top"><span>Evidence complete</span><FaCheckCircle /></div>
              <strong>{intelligence.evidencePercent}%</strong>
              <p>{intelligence.evidenceComplete.toLocaleString()} have both marketplace and source links</p>
            </article>
            <article className="ds-overview-metric">
              <div className="ds-overview-metric-top"><span>Demand 50+</span><FaChartLine /></div>
              <strong>{intelligence.demand50.toLocaleString()}</strong>
              <p>records show at least 50 sold in stored demand data</p>
            </article>
            <article className="ds-overview-metric">
              <div className="ds-overview-metric-top"><span>Avg price − BEP</span><FaLayerGroup /></div>
              <strong>{intelligence.averageSpread === null ? "—" : money(intelligence.averageSpread)}</strong>
              <p>descriptive spread across records with both values</p>
            </article>
          </section>

          <section className="ds-overview-main-grid">
            <article className="ds-overview-panel ds-overview-demand-panel">
              <div className="ds-overview-panel-head">
                <div>
                  <span className="ds-overview-kicker">DEMAND SIGNAL</span>
                  <h2>Highest stored sold counts</h2>
                </div>
                <Link to="/products">View all <FaArrowRight /></Link>
              </div>

              {intelligence.topDemand.length ? (
                <div className="ds-overview-demand-table-wrap">
                  <table className="ds-overview-demand-table">
                    <thead><tr><th>Product</th><th>Sold</th><th>Price</th><th>Price − BEP</th><th>Evidence</th></tr></thead>
                    <tbody>
                      {intelligence.topDemand.map((product) => {
                        const price = numberValue(product.Price);
                        const bep = numberValue(product.BEP);
                        const spread = price === null || bep === null ? null : price - bep;
                        const complete = Boolean(product.Sell && product.Buy);
                        return (
                          <tr key={product.id}>
                            <td><strong>{product.Title || "Untitled product"}</strong><small>{[product.Category, product.SubCategory].filter(Boolean).join(" · ") || "Uncategorized"}</small></td>
                            <td className="numeric"><strong>{numberValue(product.Sold)?.toLocaleString() || "—"}</strong></td>
                            <td className="numeric">{money(product.Price)}</td>
                            <td className="numeric">{spread === null ? "—" : money(spread)}</td>
                            <td><span className={`ds-overview-evidence ${complete ? "complete" : "partial"}`}>{complete ? "Complete" : "Needs review"}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <div className="ds-overview-empty">No demand data is available yet.</div>}
            </article>

            <article className="ds-overview-panel ds-overview-readiness-panel">
              <div className="ds-overview-panel-head compact">
                <div>
                  <span className="ds-overview-kicker">RESEARCH READINESS</span>
                  <h2>Evidence coverage</h2>
                </div>
                <FaLink className="ds-overview-panel-icon" />
              </div>
              <div className="ds-overview-readiness-number">
                <strong>{intelligence.evidencePercent}%</strong>
                <span>fully linked</span>
              </div>
              <div className="ds-overview-progress" aria-label={`${intelligence.evidencePercent}% evidence complete`}>
                <span style={{ width: `${intelligence.evidencePercent}%` }} />
              </div>
              <div className="ds-overview-readiness-stats">
                <div><span>Complete</span><strong>{intelligence.evidenceComplete}</strong></div>
                <div><span>Needs evidence</span><strong>{Math.max(0, intelligence.total - intelligence.evidenceComplete)}</strong></div>
              </div>
              <p className="ds-overview-note">Complete means both the stored marketplace evidence link and buy-source link are present.</p>
            </article>
          </section>

          <section className="ds-overview-secondary-grid">
            <article className="ds-overview-panel">
              <div className="ds-overview-panel-head compact">
                <div><span className="ds-overview-kicker">CATALOG MIX</span><h2>Largest categories</h2></div>
              </div>
              <div className="ds-overview-category-list">
                {intelligence.categories.map((category) => (
                  <div className="ds-overview-category" key={category.name}>
                    <div><span>{category.name}</span><strong>{category.count}</strong></div>
                    <div className="ds-overview-category-bar"><span style={{ width: `${Math.max(5, Math.round((category.count / maxCategoryCount) * 100))}%` }} /></div>
                  </div>
                ))}
                {!intelligence.categories.length && <div className="ds-overview-empty">No categorized products yet.</div>}
              </div>
            </article>

            <article className="ds-overview-panel">
              <div className="ds-overview-panel-head compact">
                <div><span className="ds-overview-kicker">NEEDS ATTENTION</span><h2>Missing evidence</h2></div>
                <Link to="/catalog-admin">Manage <FaArrowRight /></Link>
              </div>
              <div className="ds-overview-attention-list">
                {intelligence.attention.map((product) => (
                  <div className="ds-overview-attention-row" key={product.id}>
                    <div className="ds-overview-attention-icon"><FaExclamationTriangle /></div>
                    <div className="ds-overview-attention-copy">
                      <strong>{product.Title || "Untitled product"}</strong>
                      <span>{!product.Sell && !product.Buy ? "Missing marketplace and source links" : !product.Sell ? "Missing marketplace evidence" : "Missing buy source"}</span>
                    </div>
                    <span className="ds-overview-attention-sold">{numberValue(product.Sold)?.toLocaleString() || "—"} sold</span>
                  </div>
                ))}
                {!intelligence.attention.length && <div className="ds-overview-empty success"><FaCheckCircle /> All current products have both evidence links.</div>}
              </div>
            </article>

            <article className="ds-overview-panel">
              <div className="ds-overview-panel-head compact">
                <div><span className="ds-overview-kicker">RECENT RECORDS</span><h2>Latest catalog changes</h2></div>
              </div>
              <div className="ds-overview-recent-list">
                {intelligence.recentRecords.map((product) => (
                  <div className="ds-overview-recent-row" key={product.id}>
                    <span className={`ds-overview-status-dot ${product.status === "Updated" ? "updated" : "new"}`} />
                    <div><strong>{product.Title || "Untitled product"}</strong><span>{product.status || "Changed"} · {formatTime(product.lastModifiedAt)}</span></div>
                  </div>
                ))}
                {!intelligence.recentRecords.length && <div className="ds-overview-empty">No timestamped catalog changes yet.</div>}
              </div>
            </article>

            <article className="ds-overview-panel">
              <div className="ds-overview-panel-head compact">
                <div><span className="ds-overview-kicker">YOUR ACTIVITY</span><h2>Recent actions</h2></div>
              </div>
              <div className="ds-overview-activity-list">
                {activities.map((activity) => (
                  <div className="ds-overview-activity-row" key={activity.id}>
                    <span className="ds-overview-activity-mark" />
                    <div><strong>{activity.action || "Catalog action"}</strong><span>{formatTime(activity.timestamp)}</span></div>
                  </div>
                ))}
                {!activities.length && <div className="ds-overview-empty">No recent activity yet.</div>}
              </div>
            </article>
          </section>

          <section className="ds-overview-cta">
            <div>
              <span className="ds-overview-kicker">NEXT ACTION</span>
              <h2>Move from overview to evidence.</h2>
              <p>Use Opportunities to investigate products, or Catalog admin to maintain the underlying records.</p>
            </div>
            <div>
              <Link className="ds-button ds-button-primary" to="/products">Open opportunities <FaExternalLinkAlt /></Link>
              <Link className="ds-button ds-button-secondary" to="/catalog-admin">Manage catalog</Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default Overview;
