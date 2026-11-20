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
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fieldControlClassName } from "@/components/ui/field-control";
import { cn } from "@/lib/utils";

type SearchableSelectItem = {
  id: string;
  label: string;
  description?: string;
};

type SearchableSelectProps = {
  name: string;
  /**
   * id del campo de busqueda; si falta se genera uno. Un formulario lo pasa
   * explicito (useId cambia con los hermanos) para asociar su error.
   */
  id?: string;
  /** Con un error del campo: ActionForm enfoca el primer campo invalido. */
  "aria-invalid"?: true;
  /** id del mensaje de error (FieldError) del campo. */
  "aria-describedby"?: string;
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
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
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
  const inputId = id ?? `${name}-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

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
    const changed = nextValue !== selectedValue;

    if (!isControlled) {
      setInternalSelectedValue(nextValue);
    }

    setQuery(nextItem?.label ?? "");
    setIsOpen(false);
    onValueChange?.(nextValue);

    // Elegir una opcion o limpiarla no escribe en ningun campo, asi que no
    // hay evento input; un <select> nativo si lo dispara. RouteSheet y
    // FormDialog marcan los cambios con el onInput de su contenido: sin este
    // aviso, Cancelar cerraba sin preguntar (hallazgo 1 de la 10.5a). Sale del
    // input oculto, que no tiene onChange, y solo si el valor cambia.
    if (changed) {
      hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    }
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
    <div className="space-y-1.5" onBlur={handleBlur}>
      {/* La etiqueta y el asterisco de Field: el lector anuncia el required del campo. */}
      <label htmlFor={inputId} className="flex items-center gap-0.5 text-[0.8125rem] leading-none font-medium text-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="font-semibold text-accent-copper">
            *
          </span>
        ) : null}
      </label>

      <input ref={hiddenRef} type="hidden" name={name} value={selectedValue} />

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
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
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          required={required}
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          onChange={handleSearchChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            // El mismo aspecto que Input, con la altura y el relleno de siempre.
            fieldControlClassName,
            "h-9 w-full min-w-0 rounded-lg py-2 pr-20 pl-9 text-sm placeholder:text-placeholder disabled:pointer-events-none",
            required && !selectedValue
              ? "invalid:border-destructive invalid:ring-destructive/25"
              : "",
          )}
        />

        {selectedValue ? (
          // El contenedor centra el boton sin translate: Button se mueve con translate al
          // pasar el puntero y saltaria.
          <div className="absolute inset-y-0 right-1.5 flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearSelection}
            >
              Limpiar
            </Button>
          </div>
        ) : null}

        {showSuggestions ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-menu"
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
                    "flex w-full flex-col rounded-md px-3 py-2 text-left text-sm outline-none transition-colors",
                    index === activeIndex
                      ? "bg-primary/12 text-foreground ring-1 ring-primary/25"
                      : "text-popover-foreground hover:bg-secondary hover:text-foreground",
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
