import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  optional?: boolean;
}

export default function TextField({ id, label, optional, ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.9rem] font-semibold">
        {label}{" "}
        {optional && <span className="font-normal text-lavender/44">(optionnel)</span>}
      </label>
      <input
        id={id}
        name={id}
        className="field-input px-4 py-3.5 text-[0.95rem]"
        {...props}
      />
    </div>
  );
}
