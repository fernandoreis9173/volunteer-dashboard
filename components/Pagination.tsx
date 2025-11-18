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
    
    // Improved logic:
    // If we have 7 or fewer pages, show them all. This prevents weird "..." for small sets.
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show the first page
      pages.push(1);

      // Calculate a sliding window around the current page
      let startWindow = Math.max(2, currentPage - 1);
      let endWindow = Math.min(totalPages - 1, currentPage + 1);

      // Adjust window if we are near the start
      if (currentPage <= 4) {
          endWindow = 5; // Ensure we show at least up to page 5
          startWindow = 2;
      }
      
      // Adjust window if we are near the end
      if (currentPage >= totalPages - 3) {
          startWindow = totalPages - 4; // Ensure we show at least from total-4
          endWindow = totalPages - 1;
      }

      // Determine what comes before the window
      if (startWindow > 2) {
          // If the gap is just one number (e.g. 1 [2] 3...), show the number instead of '...'
          if (startWindow === 3) {
              pages.push(2);
          } else {
              pages.push('...');
          }
      }

      // Add the window pages
      for (let i = startWindow; i <= endWindow; i++) {
          pages.push(i);
      }

      // Determine what comes after the window
      if (endWindow < totalPages - 1) {
           // If the gap is just one number (e.g. ... 6 [7] 8), show the number instead of '...'
          if (endWindow === totalPages - 2) {
              pages.push(totalPages - 1);
          } else {
              pages.push('...');
          }
      }

      // Always show the last page
      pages.push(totalPages);
    }

    return pages.map((page, index) => (
      <li key={index}>
        {typeof page === 'string' ? (
          <span className="flex items-center justify-center px-3 h-8 leading-tight text-slate-500 dark:text-slate-400 text-sm">...</span>
        ) : (
          <button
            onClick={() => handlePageChange(page)}
            className={`flex items-center justify-center px-3 h-8 leading-tight transition-colors duration-150 rounded-lg text-sm font-medium ${
              currentPage === page
                ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
                : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white'
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
      <ul className="inline-flex flex-wrap justify-center items-center gap-1.5 sm:gap-2">
        <li>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center justify-center px-3 h-8 leading-tight text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600 transition-colors duration-150"
          >
            <span className="sr-only">Anterior</span>
            <svg className="w-3.5 h-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 1 1 5l4 4"/>
            </svg>
          </button>
        </li>
        {renderPageNumbers()}
        <li>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center justify-center px-3 h-8 leading-tight text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600 transition-colors duration-150"
          >
            <span className="sr-only">Próximo</span>
            <svg className="w-3.5 h-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
            </svg>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;