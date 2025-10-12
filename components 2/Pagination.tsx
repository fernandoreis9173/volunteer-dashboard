import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, className = '' }) => {
  if (totalPages <= 1) {
    return null;
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const renderPageNumbers = () => {
    const pages: (number | string)[] = [];
    const pageLimit = 3;
    const totalPagesToShow = pageLimit + 2;

    if (totalPages <= totalPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // FIX: Changed type to (number | string)[] to allow for '...' ellipsis.
      let startPages: (number | string)[] = [];
      // FIX: Changed type to (number | string)[] to allow for '...' ellipsis.
      let endPages: (number | string)[] = [];

      if (currentPage <= pageLimit) {
        startPages = Array.from({ length: pageLimit + 1 }, (_, i) => i + 1);
        pages.push(...startPages, '...', totalPages);
      } else if (currentPage > totalPages - pageLimit) {
        startPages = [1, '...'];
        endPages = Array.from({ length: pageLimit + 1 }, (_, i) => totalPages - pageLimit + i);
        pages.push(...startPages, ...endPages);
      } else {
        startPages = [1, '...'];
        const middlePages = [currentPage - 1, currentPage, currentPage + 1];
        endPages = ['...', totalPages];
        pages.push(...startPages, ...middlePages, ...endPages);
      }
    }

    return pages.map((page, index) => (
      <li key={index}>
        {typeof page === 'string' ? (
          <span className="flex items-center justify-center px-4 h-10 leading-tight text-slate-500">...</span>
        ) : (
          <button
            onClick={() => handlePageChange(page)}
            className={`flex items-center justify-center px-4 h-10 leading-tight transition-colors duration-150 rounded-lg ${
              currentPage === page
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            {page}
          </button>
        )}
      </li>
    ));
  };

  return (
    <nav aria-label="Pagination" className={`flex justify-center mt-8 ${className}`}>
      <ul className="inline-flex items-center space-x-2 text-sm">
        <li>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center justify-center px-4 h-10 leading-tight text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <span className="sr-only">Anterior</span>
            <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 1 1 5l4 4"/>
            </svg>
          </button>
        </li>
        {renderPageNumbers()}
        <li>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center justify-center px-4 h-10 leading-tight text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <span className="sr-only">Próximo</span>
            <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
            </svg>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;