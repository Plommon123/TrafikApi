window.addEventListener("load", () => {
  const theme = localStorage.getItem("theme");
  if (theme) setTheme(theme);
});

function toggle_theme(btn) {
  const current = document.body.getAttribute("data-theme") || "dark";
  setTheme(current === "light" ? "dark" : "light");
}

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  document.querySelectorAll(".theme-switch").forEach((b) => {
    const icon = b.querySelector("span.icon");
    if (icon) icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
    if (b.id === "header-theme-switch") {
      b.setAttribute(
        "data-tooltip",
        theme === "dark" ? "Light mode" : "Dark mode"
      );
    }
  });
  const ddTitle = document.getElementById("dropdown-toggle-title");
  if (ddTitle)
    ddTitle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}
