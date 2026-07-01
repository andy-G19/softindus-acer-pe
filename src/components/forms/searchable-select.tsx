"use client";

import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type SearchableSelectItem = {
  id: string;
  label: string;
  description?: string;
};

type SearchableSelectProps = {
  name: string;
  label: string;
  placeholder?: string;
  items: SearchableSelectItem[];
  value?: string;
  required?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  onValueChange?: (value: string) => void;
};

const MAX_VISIBLE_ITEMS = 10;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function SearchableSelect({
  name,
  label,
  placeholder = "Buscar...",
  items,
  value,
  required = false,
  disabled = false,
  emptyMessage = "No se encontraron resultados.",
  onValueChange,
}: SearchableSelectProps) {
  const generatedId = useId();
  const inputId = `${name}-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);

  const isControlled = value !== undefined;
  const [internalSelectedValue, setInternalSelectedValue] = useState(
    value ?? "",
  );
  const selectedValue = isControlled ? value ?? "" : internalSelectedValue;
  const selectedItemFromValue = items.find((item) => item.id === selectedValue);
  const [query, setQuery] = useState(selectedItemFromValue?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedValue);
  }, [items, selectedValue]);

  const filteredItems = useMemo(() => {
    const search = normalize(query);

    const matches = search
      ? items.filter((item) => {
          const searchableText = normalize(
            `${item.label} ${item.description ?? ""}`,
          );

          return searchableText.includes(search);
        })
      : items;

    return matches.slice(0, MAX_VISIBLE_ITEMS);
  }, [items, query]);

  useEffect(() => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    if (required && !selectedValue) {
      input.setCustomValidity(`Seleccione ${label.toLocaleLowerCase()}.`);
      return;
    }

    input.setCustomValidity("");
  }, [label, required, selectedValue]);

  function updateSelection(nextValue: string, nextItem?: SearchableSelectItem) {
    if (!isControlled) {
      setInternalSelectedValue(nextValue);
    }

    setQuery(nextItem?.label ?? "");
    setIsOpen(false);
    onValueChange?.(nextValue);
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setIsOpen(true);
    setActiveIndex(0);

    if (selectedValue) {
      if (!isControlled) {
        setInternalSelectedValue("");
      }

      onValueChange?.("");
    }
  }

  function handleFocus() {
    if (!disabled) {
      setQuery(selectedItem?.label ?? "");
      setActiveIndex(0);
      setIsOpen(true);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsOpen(false);

    if (selectedItem && query !== selectedItem.label) {
      setQuery(selectedItem.label);
      return;
    }

    if (!selectedItem && query) {
      setQuery("");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      if (filteredItems.length === 0) {
        return;
      }

      setActiveIndex((currentIndex) => {
        return Math.min(currentIndex + 1, filteredItems.length - 1);
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filteredItems.length === 0) {
        return;
      }

      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Enter" && isOpen && filteredItems[activeIndex]) {
      event.preventDefault();
      updateSelection(filteredItems[activeIndex].id, filteredItems[activeIndex]);
    }
  }

  function clearSelection() {
    updateSelection("");
    inputRef.current?.focus();
  }

  const showSuggestions = isOpen && !disabled;
  const displayValue = !isOpen ? selectedItem?.label ?? "" : query;

  return (
    <div className="space-y-2" onBlur={handleBlur}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </label>

      <input type="hidden" name={name} value={selectedValue} />

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showSuggestions}
          aria-activedescendant={
            showSuggestions && filteredItems[activeIndex]
              ? `${listboxId}-${filteredItems[activeIndex].id}`
              : undefined
          }
          required={required}
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          onChange={handleSearchChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
            required && !selectedValue
              ? "invalid:border-destructive invalid:ring-destructive/20"
              : "",
          )}
        />

        {selectedValue ? (
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            Limpiar
          </button>
        ) : null}

        {showSuggestions ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-background p-1 shadow-lg"
          >
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  id={`${listboxId}-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={item.id === selectedValue}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => updateSelection(item.id, item)}
                  className={cn(
                    "flex w-full flex-col rounded-md px-3 py-2 text-left text-sm outline-none",
                    index === activeIndex
                      ? "bg-muted text-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
