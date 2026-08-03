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
        className="w-full rounded-xl border border-lavender/14 bg-bg-deep/55 px-4 py-3.5 text-[0.95rem] text-inherit transition-colors duration-200 placeholder:text-lavender/44 hover:border-lavender/28 focus:border-purple-soft focus:bg-purple/[0.08] focus:shadow-[0_0_0_3px_rgba(126,20,255,0.22)] focus:outline-none"
        {...props}
      />
    </div>
  );
}
