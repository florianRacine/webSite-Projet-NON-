document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;

  const response = await fetch('/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();
  if (data.error) {
    showError(data.error);
  } else {
    window.location.href = '/home.html';
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  const response = await fetch('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();
  if (data.error) {
    showError(data.error);
  } else {
    window.location.href = '/home.html';
  }
});

function showError(errorMessage) {
  const errorContainer = document.getElementById('error-container');
  errorContainer.textContent = errorMessage;
  errorContainer.style.display = 'block';
}

