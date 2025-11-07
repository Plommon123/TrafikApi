const backdrop = document.getElementById("dropdown-backdrop");
const dropdown = document.getElementById("dropdown-container");

function open_dropdown() {
  dropdown.classList.toggle("hidden");
  backdrop.classList.toggle("hidden");
  backdrop.addEventListener("click", close_dropdown);
}

function close_dropdown() {
  dropdown.classList.add("hidden");
  backdrop.classList.add("hidden");
  backdrop.removeEventListener("click", close_dropdown);
}

dropdown && dropdown.addEventListener("click", (e) => e.stopPropagation());
