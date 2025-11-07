window.addEventListener("load", () => {
	const theme = localStorage.getItem("theme");
	if (theme) {
		set_theme(theme);
	}
});

const theme_btns = document.querySelectorAll(".theme-switch");
const header_theme_switch = document.getElementById("header-theme-switch");
const dropdown_title = document.getElementById("dropdown-toggle-title");

function toggle_theme() {
	let theme = document.body.getAttribute("data-theme");

	if (theme === "light") {
		set_theme("dark");
	} else {
		set_theme("light");
	}
}

function set_theme(theme) {
	theme_btns.forEach((btn) => {
		btn.querySelector("span").innerHTML =
			theme === "dark" ? "light_mode" : "dark_mode";
		dropdown_title.innerHTML = theme === "dark" ? "Ljust läge" : "Mörkt läge";
	});
	header_theme_switch.setAttribute(
		"data-tooltip",
		theme === "dark" ? "Ljust läge" : "Mörkt läge"
	);

	document.body.setAttribute("data-theme", theme);
	localStorage.setItem("theme", theme);
}
