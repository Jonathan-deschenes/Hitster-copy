import type { SelectHTMLAttributes } from "react";

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path
        d="M4.5 7l4.5 4.5L13.5 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      <label htmlFor={id} className="text-[0.9rem] font-semibold">
        {label}{" "}
        {optional && <span className="font-normal text-lavender/44">(optionnel)</span>}
      </label>
      <div className="relative flex">
        <select
          id={id}
          name={id}
          className="w-full appearance-none rounded-xl border border-lavender/14 bg-bg-deep/55 px-4 py-3.5 pr-11 text-[0.95rem] text-inherit transition-colors duration-200 hover:border-lavender/28 focus:border-purple-soft focus:bg-purple/[0.08] focus:shadow-[0_0_0_3px_rgba(126,20,255,0.22)] focus:outline-none"
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
