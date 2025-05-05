function sanitizeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function createButton(name, trackerId) {
  const button = document.createElement('button');
  button.className = 'button';

  // Use the trackerId as-is if it starts with https://
  const url = trackerId.startsWith('https://') ? trackerId : `https://trackerhub.cx/sh/${trackerId}`;
  button.onclick = () => window.open(url);

  const img = document.createElement('img');
  const sanitizedName = sanitizeFileName(name);
  img.src = `assets/images/${sanitizedName}.png`;
  img.alt = name;

  const textDiv = document.createElement('div');
  textDiv.className = 'button-text';

  const h2 = document.createElement('h2');
  h2.textContent = name;

  textDiv.appendChild(h2);
  button.appendChild(img);
  button.appendChild(textDiv);

  document.getElementById('button-grid').appendChild(button);
}



function loadCSVAndGenerateButtons() {
  Papa.parse('trackers.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      results.data.forEach(row => {
        createButton(row['Artist Name'], row['Tracker URL']);
      });
    },
    error: function(err) {
      console.error("Failed to load CSV", err);
    }
  });
}

// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
  loadCSVAndGenerateButtons();
});
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