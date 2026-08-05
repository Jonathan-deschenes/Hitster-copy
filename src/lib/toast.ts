import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";

type ToastVariant = "join" | "leave" | "closed" | "error";

const VARIANT_BACKGROUND: Record<ToastVariant, string> = {
	join: "linear-gradient(135deg, #47bfff, #7e14ff)",
	leave: "linear-gradient(135deg, #863bff, #7e14ff)",
	closed: "linear-gradient(135deg, #ff4d6d, #7e14ff)",
	error: "linear-gradient(135deg, #ff4d6d, #ff8a3d)",
};

export function showToast(text: string, variant: ToastVariant = "leave") {
	Toastify({
		text,
		duration: 3500,
		close: true,
		gravity: "top",
		position: "right",
		stopOnFocus: true,
		style: {
			background: VARIANT_BACKGROUND[variant],
			borderRadius: "12px",
			fontFamily: "Inter, system-ui, sans-serif",
			fontSize: "0.9rem",
			boxShadow: "0 10px 28px -8px rgba(0, 0, 0, 0.45)",
		},
	}).showToast();
}
