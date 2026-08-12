import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  optional?: boolean;
}

export default function TextField({ id, label, optional, ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      <label htmlFor={id} className="text-[0.85rem] font-semibold sm:text-[0.9rem]">
        {label}{" "}
        {optional && <span className="font-normal text-lavender/44">(optionnel)</span>}
      </label>
      <input
        id={id}
        name={id}
        className="field-input px-3.5 py-3 text-[0.9rem] sm:px-4 sm:py-3.5 sm:text-[0.95rem]"
        {...props}
      />
    </div>
  );
}
