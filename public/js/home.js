document.addEventListener("DOMContentLoaded", () => {
  const layout = document.getElementById("layout");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mainToggle = document.getElementById("main-toggle");

  function collapseSidebar() {
    layout.classList.add("sidebar-collapsed");
  }

  function expandSidebar() {
    layout.classList.remove("sidebar-collapsed");
  }

  sidebarToggle.addEventListener("click", collapseSidebar);
  mainToggle.addEventListener("click", expandSidebar);
});
