"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface WrestlerResult {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  brand: string | null;
}

interface WrestlerAutocompleteProps {
  value: string;
  onChange: (value: string, imageUrl?: string | null) => void;
  onSelect?: (wrestler: WrestlerResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  allowCreate?: boolean;
  onCreateRequest?: (name: string) => void;
}

export function WrestlerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search wrestlers...",
  className,
  disabled,
  autoFocus,
  allowCreate = false,
  onCreateRequest,
}: WrestlerAutocompleteProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [results, setResults] = React.useState<WrestlerResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Debounce search
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Search function
  const searchWrestlers = React.useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/wrestlers/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data: WrestlerResult[] = await res.json();
        setResults(data);
        // Open dropdown if we have results OR if allowCreate is enabled (to show "Add new" option)
        setIsOpen(data.length > 0 || allowCreate);
        setHighlightedIndex(-1);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [allowCreate]);

  // Handle input change with debounce
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce search
      debounceRef.current = setTimeout(() => {
        searchWrestlers(newValue);
      }, 300);
    },
    [onChange, searchWrestlers]
  );

  // Handle selection
  const handleSelect = React.useCallback(
    (wrestler: WrestlerResult) => {
      onChange(wrestler.name, wrestler.imageUrl);
      onSelect?.(wrestler);
      setIsOpen(false);
      setResults([]);
      inputRef.current?.focus();
    },
    [onChange, onSelect]
  );

  // Calculate total selectable items (results + optional create button)
  const hasCreateOption = allowCreate && onCreateRequest && value.length >= 2;
  const totalItems = results.length + (hasCreateOption ? 1 : 0);
  const createOptionIndex = results.length; // The "create" option is always last

  // Handle create action
  const handleCreate = React.useCallback(() => {
    if (onCreateRequest) {
      onCreateRequest(value);
      setIsOpen(false);
    }
  }, [onCreateRequest, value]);

  // Keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || totalItems === 0) {
        if (e.key === "Escape") {
          setIsOpen(false);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < results.length) {
            handleSelect(results[highlightedIndex]);
          } else if (highlightedIndex === createOptionIndex && hasCreateOption) {
            handleCreate();
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
        case "Tab":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, totalItems, results, highlightedIndex, handleSelect, handleCreate, createOptionIndex, hasCreateOption]
  );

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          className={cn(
            "h-9 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-1 text-base text-white shadow-xs transition-colors",
            "placeholder:text-gray-500",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:border-purple-500",
            "disabled:pointer-events-none disabled:opacity-50",
            className
          )}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-purple-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (results.length > 0 || hasCreateOption) && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border border-gray-600 bg-gray-800 shadow-lg"
        >
          {results.map((wrestler, index) => (
            <li
              key={wrestler.id}
              onClick={() => handleSelect(wrestler)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                highlightedIndex === index
                  ? "bg-purple-600/40"
                  : "hover:bg-gray-700"
              )}
            >
              {/* Wrestler Image */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-gray-700">
                {wrestler.imageUrl ? (
                  <img
                    src={wrestler.imageUrl}
                    alt={wrestler.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide broken images
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                    {wrestler.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Wrestler Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{wrestler.name}</p>
                {wrestler.brand && (
                  <p className="text-xs text-gray-400">{wrestler.brand}</p>
                )}
              </div>
            </li>
          ))}

          {/* Add new wrestler option - always shown at bottom when allowCreate is true */}
          {hasCreateOption && (
            <li
              onClick={handleCreate}
              onMouseEnter={() => setHighlightedIndex(createOptionIndex)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-t border-gray-700",
                highlightedIndex === createOptionIndex
                  ? "bg-purple-600/40"
                  : "hover:bg-gray-700"
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm text-purple-400">
                Add &quot;{value}&quot; to wrestler database
              </span>
            </li>
          )}
        </ul>
      )}

      {/* No results message when create is not allowed */}
      {isOpen && results.length === 0 && value.length >= 2 && !loading && !hasCreateOption && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-600 bg-gray-800 shadow-lg">
          <div className="px-3 py-2 text-sm text-gray-400">
            No wrestlers found
          </div>
        </div>
      )}
    </div>
  );
}
