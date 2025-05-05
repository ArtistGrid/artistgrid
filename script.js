const buttons = document.querySelectorAll('.button');

buttons.forEach(button => {
  button.addEventListener('click', event => {
    // Do something when button is clicked
  });
});

function search(input) {
  const buttons = document.querySelectorAll('#button-grid .button');
  let anyVisible = false;

  buttons.forEach(button => {
    const nameElement = button.querySelector('h2');
    const name = nameElement.innerText.toLowerCase();
    if (name.includes(input.toLowerCase())) {
      button.style.display = '';
      anyVisible = true;
    } else {
      button.style.display = 'none';
    }
  });

  const noresults = document.getElementById('noresults');
  if (noresults) {
    noresults.style.display = anyVisible ? 'none' : '';
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
function toggleDisclaimer() {
  const disclaimer = document.getElementById("disclaimer-container");
  disclaimer.classList.toggle("show");
}
