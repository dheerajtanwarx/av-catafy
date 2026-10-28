"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function TagInput({
  value,
  onChange,
  id,
  placeholder = "Type and press Enter",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tags = draft
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !value.includes(t));
    if (tags.length) onChange([...value, ...tags]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {value.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-background"
                  aria-label={`Remove ${tag}`}
                  onClick={() => onChange(value.filter((t) => t !== tag))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
