import React from "react";
import "./pagination.css";

const Pagination = ({
  totalItems,
  itemsPerPage = 10,
  currentPage = 1,
  onPageChange,
  pageRange = 2,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  if (totalItems <= itemsPerPage) return null;

  const goToPage = (page) => onPageChange(Math.min(totalPages, Math.max(1, page)));
  const start = Math.max(1, currentPage - pageRange);
  const end = Math.min(totalPages, currentPage + pageRange);
  const pages = [];
  for (let page = start; page <= end; page += 1) pages.push(page);

  return (
    <nav className="ds-pagination" aria-label="Product result pages">
      <button type="button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>Previous</button>
      {start > 1 && <button type="button" onClick={() => goToPage(1)}>1</button>}
      {start > 2 && <span>…</span>}
      {pages.map((page) => (
        <button
          type="button"
          key={page}
          className={page === currentPage ? "active" : ""}
          aria-current={page === currentPage ? "page" : undefined}
          onClick={() => goToPage(page)}
        >
          {page}
        </button>
      ))}
      {end < totalPages - 1 && <span>…</span>}
      {end < totalPages && <button type="button" onClick={() => goToPage(totalPages)}>{totalPages}</button>}
      <button type="button" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>Next</button>
    </nav>
  );
};

export default Pagination;
