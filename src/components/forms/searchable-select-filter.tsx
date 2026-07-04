"use client";

import { useState } from "react";

import { SearchableSelect } from "@/components/forms/searchable-select";

type SearchableSelectFilterItem = {
  id: string;
  label: string;
  description?: string;
};

type SearchableSelectFilterProps = {
  name: string;
  label: string;
  placeholder?: string;
  items: SearchableSelectFilterItem[];
  value?: string;
  required?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
};

export function SearchableSelectFilter({
  value,
  ...props
}: SearchableSelectFilterProps) {
  const [selectedValue, setSelectedValue] = useState(value ?? "");

  return (
    <SearchableSelect
      {...props}
      value={selectedValue}
      onValueChange={setSelectedValue}
    />
  );
}
