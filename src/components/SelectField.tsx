import type { SelectHTMLAttributes } from "react";
import { IconChevronDown } from "./icons/GameIcons";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id: string;
  label: string;
  options: SelectOption[];
  optional?: boolean;
  hint?: string;
}

export default function SelectField({
  id,
  label,
  options,
  optional,
  hint,
  ...props
}: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="field-label">
        {label}{" "}
        {optional && <span className="font-normal text-lavender/44">(optionnel)</span>}
      </label>
      <div className="relative flex">
        <select
          id={id}
          name={id}
          className="field-input px-4 py-3.5 text-[0.95rem] appearance-none pr-11"
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-bg-deep text-white">
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-lavender/68">
          <IconChevronDown />
        </span>
      </div>
      {hint && <p className="text-[0.8rem] leading-[1.5] text-lavender/44">{hint}</p>}
    </div>
  );
}
