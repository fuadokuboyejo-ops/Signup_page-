// ============================================
// SUPABASE CONFIGURATION
// ============================================

const SUPABASE_URL = 'https://divhhvbbvrglafgzohpn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpdmhodmJidnJnbGFmZ3pvaHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjE3MTUsImV4cCI6MjA4MTY5NzcxNX0.gi9NBjBB-nTqwrGUwV38YQG_AuhgI73QZmNcedfTB08';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// WAITLIST SIGNUP APPLICATION
// ============================================

// DOM Elements
const signupForm = document.getElementById('signup-form');
const emailInput = document.getElementById('email-input');
const submitBtn = document.getElementById('submit-btn');
const successMessage = document.getElementById('success-message');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// ============================================
// EMAIL VALIDATION
// ============================================

/**
 * Validates email format using regex
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================
// SUPABASE DATABASE MANAGEMENT
// ============================================

/**
 * Saves a new signup to Supabase
 * @param {string} email - Email address to save
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function saveSignup(email) {
  try {
    // INSERT only - no .select() to avoid requiring SELECT permission
    const { error } = await supabaseClient
      .from('waitlist')
      .insert([{ email: email.toLowerCase() }]);

    if (error) {
      // Check if it's a duplicate email error (unique constraint violation)
      if (error.code === '23505' || error.message.includes('unique')) {
        return { success: false, error: 'duplicate' };
      }
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Network error:', err);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

// ============================================
// EMAIL NOTIFICATIONS
// ============================================

/**
 * Sends a welcome email to the user via Supabase Edge Function
 * @param {string} email - Email address to send welcome email to
 */
async function sendWelcomeEmail(email) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-welcome-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: email.toLowerCase() }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to send welcome email:', data);
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending welcome email:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// UI FEEDBACK
// ============================================

/**
 * Shows success message
 */
function showSuccess() {
  successMessage.classList.add('show');
  errorMessage.classList.remove('show');
  emailInput.classList.remove('error');
  emailInput.classList.add('success');
}

/**
 * Shows error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.add('show');
  successMessage.classList.remove('show');
  emailInput.classList.add('error');
  emailInput.classList.remove('success');
}

/**
 * Hides all messages
 */
function hideMessages() {
  successMessage.classList.remove('show');
  errorMessage.classList.remove('show');
  emailInput.classList.remove('error', 'success');
}

// ============================================
// RATE LIMITING
// ============================================

const RATE_LIMIT_KEY = 'jobley_signup_attempts';
const MAX_ATTEMPTS = 3; // Maximum submissions allowed
const TIME_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Checks if the user has exceeded rate limit
 * @returns {{allowed: boolean, remainingTime?: number}} - Rate limit status
 */
function checkRateLimit() {
  try {
    const now = Date.now();
    const attempts = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');

    // Filter out attempts outside the time window
    const recentAttempts = attempts.filter(timestamp => now - timestamp < TIME_WINDOW);

    // Update localStorage with only recent attempts
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recentAttempts));

    // Check if user has exceeded the limit
    if (recentAttempts.length >= MAX_ATTEMPTS) {
      const oldestAttempt = Math.min(...recentAttempts);
      const remainingTime = TIME_WINDOW - (now - oldestAttempt);
      return { allowed: false, remainingTime };
    }

    return { allowed: true };
  } catch (err) {
    // If localStorage is not available, allow the request
    console.warn('Rate limiting unavailable:', err);
    return { allowed: true };
  }
}

/**
 * Records a submission attempt
 */
function recordAttempt() {
  try {
    const now = Date.now();
    const attempts = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');
    attempts.push(now);
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(attempts));
  } catch (err) {
    console.warn('Could not record attempt:', err);
  }
}

/**
 * Formats remaining time in a human-readable format
 * @param {number} ms - Milliseconds remaining
 * @returns {string} - Formatted time string
 */
function formatRemainingTime(ms) {
  const minutes = Math.ceil(ms / 60000);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

// ============================================
// FORM SUBMISSION
// ============================================

/**
 * Handles form submission
 * @param {Event} e - Form submit event
 */
async function handleSubmit(e) {
  e.preventDefault();

  const email = emailInput.value.trim();

  // Check rate limit first
  const rateLimitCheck = checkRateLimit();
  if (!rateLimitCheck.allowed) {
    const timeRemaining = formatRemainingTime(rateLimitCheck.remainingTime);
    showError(`Too many attempts. Please try again in ${timeRemaining}.`);
    return;
  }

  // Validate email format
  if (!isValidEmail(email)) {
    showError('Please enter a valid email address.');
    return;
  }

  // Disable button during processing
  submitBtn.disabled = true;
  submitBtn.textContent = 'Joining...';

  // Save to Supabase
  const result = await saveSignup(email);

  if (result.success) {
    // Record this attempt for rate limiting
    recordAttempt();

    showSuccess();
    emailInput.value = '';

    // Send welcome email (don't block on this)
    sendWelcomeEmail(email);
  } else {
    // Handle different error types
    if (result.error === 'duplicate') {
      showError('This email is already on the waitlist!');
    } else {
      showError(result.error || 'Something went wrong. Please try again.');
    }
  }

  // Re-enable button
  submitBtn.disabled = false;
  submitBtn.textContent = 'Join Waitlist';
}

// ============================================
// INPUT VALIDATION ON TYPE
// ============================================

/**
 * Handles real-time input validation
 */
function handleInput() {
  // Hide messages when user starts typing again
  if (successMessage.classList.contains('show') || errorMessage.classList.contains('show')) {
    hideMessages();
  }
}

// ============================================
// SMOOTH SCROLL ANIMATIONS
// ============================================

/**
 * Adds scroll-triggered animations
 */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    },
    { threshold: 0.1 }
  );

  // Observe feature cards
  document.querySelectorAll('.feature-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(card);
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

signupForm.addEventListener('submit', handleSubmit);
emailInput.addEventListener('input', handleInput);

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  console.log('🚀 Jobley waitlist form ready');
});
