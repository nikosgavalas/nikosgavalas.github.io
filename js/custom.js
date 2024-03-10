document.addEventListener("DOMContentLoaded", (event) => {
  document.querySelectorAll("code.language-cpp").forEach((block) => {
    hljs.highlightBlock(block);
  });
  document.querySelectorAll("code.language-python").forEach((block) => {
    hljs.highlightBlock(block);
  });
  document.querySelectorAll("code.language-bash").forEach((block) => {
    hljs.highlightBlock(block);
  });
});
