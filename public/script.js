document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const totalRecipientsDisplay = document.getElementById('total-recipients');
    const testEmailInput = document.getElementById('test-email');
    const sendTestBtn = document.getElementById('send-test');
    const testStatus = document.getElementById('test-status');
    const distributionPoints = document.getElementById('distribution-points');
    const emailList = document.getElementById('email-list');
    const emailListCount = document.getElementById('email-list-count');
    const mailIcon = document.querySelector('.mail-icon');
    const howItWorksBtn = document.getElementById('how-it-works-btn');
    const howItWorksModal = document.getElementById('how-it-works-modal');
    const closeModal = document.querySelector('.close-modal');
    
    // Initialize variables
    let emailListSource = []; // Real emails from file
    let emailsIndex = 0;      // Current position in real email list
    let sentEmails = [];
    let isCampaignRunning = false;
    let intervalId = null;
    let maxEmailsToShow = 25; // Fixed number of emails to show in list
    
    // Path to email file (in public directory)
    const EMAIL_FILE_PATH = '/data/emails.txt';
    
    // Distribution rate settings
    const EMAILS_PER_SECOND = 10; // Rate of sending emails
    const BATCH_SIZE = 3; // Visual emails per interval
    const INTERVAL_MS = 300; // Interval between batches
    
    // Get mail icon position
    const getMailIconPosition = () => {
        const rect = mailIcon.getBoundingClientRect();
        return {
            x: (rect.left + rect.width / 2) / window.innerWidth * 100,
            y: (rect.top + rect.height / 2) / window.innerHeight * 100
        };
    };
    
    // Load or initialize persistence data
    let persistenceData = loadPersistenceData();
    let totalRecipients = persistenceData.totalRecipients;
    updateTotalRecipients();
    
    // Load saved emails from localStorage
    sentEmails = persistenceData.emailList || [];
    emailListSource = persistenceData.emailListSource || [];
    emailsIndex = persistenceData.emailsIndex || 0;
    
    // Update the email list with saved emails
    updateEmailListDisplay();
    
    // Update the email list count to match total recipients
    emailListCount.textContent = totalRecipients.toLocaleString();
    
    // Automatically load emails from file if we don't have them already
    if (emailListSource.length === 0) {
        loadEmailsFromFile();
    } else {
        console.log(`Using ${emailListSource.length} emails from previous session. Current position: ${emailsIndex}`);
    }
    
    // Handle time passed while page was closed
    handleTimePassed();
    
    // Create list of domains for generating random emails as fallback
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com', 
                     'protonmail.com', 'aol.com', 'mail.com', 'zoho.com', 'yandex.com',
                     'gmx.com', 'live.com', 'fastmail.com', 'inbox.com', 'mail.ru'];
    
    const tlds = ['.com', '.net', '.org', '.io', '.co', '.us', '.uk', '.ca', '.au', '.de', 
                 '.fr', '.jp', '.br', '.it', '.es', '.nl', '.ru', '.cn', '.in'];
    
    // Generate random emails only as fallback
    function generateRandomEmail() {
        if (Math.random() > 0.7) {
            // Company email
            const company = generateRandomString(Math.floor(Math.random() * 10) + 3);
            const username = generateRandomString(Math.floor(Math.random() * 8) + 3);
            const tld = tlds[Math.floor(Math.random() * tlds.length)];
            return `${username}@${company}${tld}`;
        } else {
            // Common domain email
            const username = generateRandomString(Math.floor(Math.random() * 10) + 3);
            const domain = domains[Math.floor(Math.random() * domains.length)];
            return `${username}@${domain}`;
        }
    }
    
    function generateRandomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // Load emails from file automatically
    function loadEmailsFromFile() {
        console.log(`Loading emails from ${EMAIL_FILE_PATH}`);
        
        fetch(EMAIL_FILE_PATH)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(content => {
                // Split by newlines, trim whitespace, filter empty lines
                const emails = content.split(/[\r\n]+/)
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                    
                // Basic validation - check if they look like emails
                const validEmails = emails.filter(email => {
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                });
                
                if (validEmails.length === 0) {
                    console.error('No valid email addresses found in file.');
                    return;
                }
                
                // Store emails and reset index
                emailListSource = validEmails;
                emailsIndex = 0;
                
                console.log(`Successfully loaded ${validEmails.length} email addresses.`);
                
                // Save to persistence
                savePersistenceData();
                
                // Restart distribution with new emails
                restartDistribution();
            })
            .catch(error => {
                console.error('Error loading email file:', error);
                
                // If we have stored emails from before, use those
                if (persistenceData.emailListSource && persistenceData.emailListSource.length > 0) {
                    emailListSource = persistenceData.emailListSource;
                    emailsIndex = persistenceData.emailsIndex || 0;
                    console.log(`Using ${emailListSource.length} emails from previous session.`);
                } else {
                    // Otherwise fall back to random emails
                    console.log('Using random emails as fallback.');
                }
            });
    }
    
    // Function to get next email from source or random if needed
    function getNextEmail() {
        // If we have emails from file, use those first
        if (emailListSource.length > 0) {
            // If we've used all emails, start over from the beginning
            if (emailsIndex >= emailListSource.length) {
                emailsIndex = 0;
            }
            
            const email = emailListSource[emailsIndex];
            emailsIndex++;
            
            return email;
        }
        
        // Fall back to random emails if no file loaded
        return generateRandomEmail();
    }
    
    // Create distribution point effect
    function createDistributionPoint() {
        // Get the mail icon position as the source
        const mailPos = getMailIconPosition();
        
        // Create a point at a random position on the map
        const point = document.createElement('div');
        point.className = 'distribution-point';
        
        // Random position on the map
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        
        point.style.left = `${x}%`;
        point.style.top = `${y}%`;
        point.style.opacity = '0';
        
        distributionPoints.appendChild(point);
        
        // Create line from mail icon to this point
        createDistributionLine(mailPos.x, mailPos.y, x, y);
        
        // Animate point
        setTimeout(() => {
            point.style.opacity = '1';
            point.style.transition = 'opacity 0.5s ease-in, transform 0.5s ease-in';
            point.style.transform = 'scale(1.5)';
            
            setTimeout(() => {
                point.style.opacity = '0';
                point.style.transform = 'scale(0.5)';
                
                setTimeout(() => {
                    point.remove();
                }, 500);
            }, 1000);
        }, 10);
    }
    
    function createDistributionLine(startX, startY, endX, endY) {
        const line = document.createElement('div');
        line.className = 'distribution-line';
        
        // Calculate length and angle
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // Position and rotate line
        line.style.left = `${startX}%`;
        line.style.top = `${startY}%`;
        line.style.width = `0%`;
        line.style.transform = `rotate(${angle}deg)`;
        
        distributionPoints.appendChild(line);
        
        // Animate line growing
        setTimeout(() => {
            line.style.transition = 'width 0.7s ease-out';
            line.style.width = `${length}%`;
            
            setTimeout(() => {
                line.style.opacity = '0';
                line.style.transition = 'opacity 0.3s ease-out';
                
                setTimeout(() => {
                    line.remove();
                }, 300);
            }, 700);
        }, 10);
    }
    
    // Add email to the list display and storage
    function addEmailToList(email) {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const dateString = now.toLocaleDateString();
        
        // Create new email item for the list
        const emailItem = document.createElement('div');
        emailItem.className = 'email-list-item';
        emailItem.innerHTML = `
            <div class="email-address">${email}</div>
            <div class="timestamp">${timeString} - ${dateString}</div>
        `;
        
        // Add to the DOM
        emailList.insertBefore(emailItem, emailList.firstChild);
        
        // Animate entrance
        setTimeout(() => {
            emailItem.classList.add('show');
        }, 10);
        
        // Store in memory
        sentEmails.unshift({
            email: email,
            timestamp: now.toISOString()
        });
        
        // Limit array size for UI and storage (more than displayed but not too many)
        if (sentEmails.length > 100) {
            sentEmails = sentEmails.slice(0, 100);
        }
        
        // Limit list items in the DOM
        const items = emailList.querySelectorAll('.email-list-item');
        if (items.length > maxEmailsToShow) {
            for (let i = maxEmailsToShow; i < items.length; i++) {
                items[i].remove();
            }
        }
        
        // Save updated emails list
        savePersistenceData();
    }
    
    // Update the email list display from the sentEmails array
    function updateEmailListDisplay() {
        // Clear existing list
        emailList.innerHTML = '';
        
        // Add emails to the list (limited to maxEmailsToShow)
        const emailsToShow = sentEmails.slice(0, maxEmailsToShow);
        emailsToShow.forEach(item => {
            const date = new Date(item.timestamp);
            const timeString = date.toLocaleTimeString();
            const dateString = date.toLocaleDateString();
            
            const emailItem = document.createElement('div');
            emailItem.className = 'email-list-item show';
            emailItem.innerHTML = `
                <div class="email-address">${item.email}</div>
                <div class="timestamp">${timeString} - ${dateString}</div>
            `;
            
            emailList.appendChild(emailItem);
        });
    }
    
    // Function to restart distribution
    function restartDistribution() {
        stopDistribution();
        setTimeout(distributeEmails, 100);
    }
    
    // Main email distribution function
    function distributeEmails() {
        if (isCampaignRunning) return;
        
        isCampaignRunning = true;
        
        // Continuously distribute emails
        intervalId = setInterval(() => {
            // Send multiple emails at once for faster distribution
            for (let i = 0; i < BATCH_SIZE; i++) {
                // Create distribution effect
                createDistributionPoint();
                
                // Get next email from our source or random generator
                const email = getNextEmail();
                
                // Add to list (only add 1 per batch to reduce UI updates)
                if (i === 0) {
                    addEmailToList(email);
                }
                
                // Update total recipients
                totalRecipients++;
            }
            
            // Update both counters to match
            updateTotalRecipients();
            emailListCount.textContent = totalRecipients.toLocaleString();
            
            // Save progress to persistence
            savePersistenceData();
            
        }, INTERVAL_MS); // Speed of distribution
    }
    
    function stopDistribution() {
        clearInterval(intervalId);
        isCampaignRunning = false;
    }
    
    // Auto-start distribution on page load
    setTimeout(distributeEmails, 1000);
    
    // Send test email button
    sendTestBtn.addEventListener('click', function() {
        const testEmail = testEmailInput.value.trim();
        
        if (!testEmail) {
            showTestStatus('Please enter a valid email address', 'error');
            return;
        }
        
        if (!validateEmail(testEmail)) {
            showTestStatus('Invalid email format', 'error');
            return;
        }
        
        // Show loading state
        sendTestBtn.disabled = true;
        sendTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...';
        showTestStatus('Sending test coin distribution...', 'info');
        
        // Get mail icon position
        const mailPos = getMailIconPosition();
        
        // Create visual distribution effect
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                createDistributionPoint();
            }, i * 100);
        }
        
        // Simulate loading
        setTimeout(() => {
            // Send test email via API
            fetch('/api/send-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: testEmail })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showTestStatus('Test coin successfully sent to your email!', 'success');
                    
                    // Add to email list
                    addEmailToList(testEmail);
                    
                    // Update total recipients
                    totalRecipients++;
                    updateTotalRecipients();
                    emailListCount.textContent = totalRecipients.toLocaleString();
                    savePersistenceData();
                } else {
                    showTestStatus(`Failed to send test coin: ${data.error}`, 'error');
                }
            })
            .catch(error => {
                showTestStatus('Server connection error. Please try again.', 'error');
                console.error('Error:', error);
            })
            .finally(() => {
                // Reset button state
                sendTestBtn.disabled = false;
                sendTestBtn.innerHTML = '<i class="fas fa-vial"></i> SEND TEST COIN';
            });
        }, 1000);
    });
    
    // Modal functionality
    howItWorksBtn.addEventListener('click', function(e) {
        e.preventDefault();
        howItWorksModal.style.display = 'block';
    });
    
    closeModal.addEventListener('click', function() {
        howItWorksModal.style.display = 'none';
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === howItWorksModal) {
            howItWorksModal.style.display = 'none';
        }
    });
    
    // Helper functions
    function updateTotalRecipients() {
        totalRecipientsDisplay.textContent = totalRecipients.toLocaleString();
    }
    
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    function showTestStatus(message, type) {
        testStatus.textContent = message;
        testStatus.className = 'status-message';
        testStatus.classList.add(type);
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                testStatus.style.display = 'none';
            }, 5000);
        }
    }
    
    // Persistence functions
    function loadPersistenceData() {
        try {
            const savedData = localStorage.getItem('coinmailPersistence');
            if (savedData) {
                const data = JSON.parse(savedData);
                return {
                    totalRecipients: data.totalRecipients || 0,
                    lastTimestamp: data.lastTimestamp || Date.now(),
                    emailList: data.emailList || [],
                    emailListSource: data.emailListSource || [],
                    emailsIndex: data.emailsIndex || 0
                };
            }
        } catch (e) {
            console.error('Error loading persistence data:', e);
        }
        
        // Default values if no data or error
        return {
            totalRecipients: 0,
            lastTimestamp: Date.now(),
            emailList: [],
            emailListSource: [],
            emailsIndex: 0
        };
    }
    
    function savePersistenceData() {
        try {
            const data = {
                totalRecipients: totalRecipients,
                lastTimestamp: Date.now(),
                emailList: sentEmails,
                emailListSource: emailListSource,
                emailsIndex: emailsIndex
            };
            localStorage.setItem('coinmailPersistence', JSON.stringify(data));
        } catch (e) {
            console.error('Error saving persistence data:', e);
        }
    }
    
    // Handle time passed while page was closed
    function handleTimePassed() {
        const now = Date.now();
        const timePassed = now - persistenceData.lastTimestamp;
        
        if (timePassed > 1000) { // If more than 1 second has passed
            // Calculate how many emails would have been sent during this time
            const secondsPassed = Math.floor(timePassed / 1000);
            const emailsSent = secondsPassed * EMAILS_PER_SECOND;
            
            // Update total recipients
            totalRecipients += emailsSent;
            updateTotalRecipients();
            
            // Also update the email list counter to match
            emailListCount.textContent = totalRecipients.toLocaleString();
            
            console.log(`Added ${emailsSent} emails for ${secondsPassed} seconds passed while page was closed`);
            
            // Update email index position for real emails
            if (emailListSource.length > 0) {
                // Calculate new position with wrap-around
                emailsIndex = (emailsIndex + emailsSent) % emailListSource.length;
            }
            
            // Add some of the "missed" emails to the list
            const newEmails = Math.min(20, emailsSent); // Add up to 20 new emails to the list
            
            // Generate some visual effects to show emails being caught up
            const catchUpEffects = Math.min(50, emailsSent); // Cap visual effects
            for (let i = 0; i < catchUpEffects; i++) {
                setTimeout(() => {
                    createDistributionPoint();
                    
                    // Add some emails to the list for visual feedback of emails sent while closed
                    if (i % 5 === 0 && i < newEmails) {
                        // Create a timestamp for when this email would have been sent while page was closed
                        const emailTimestamp = new Date(now - (secondsPassed * 1000) + (i * secondsPassed * 1000 / newEmails));
                        
                        // Use real emails if available
                        const emailPos = (emailsIndex - newEmails + Math.floor(i/5)) % emailListSource.length;
                        const email = emailListSource.length > 0 
                            ? emailListSource[emailPos >= 0 ? emailPos : emailListSource.length + emailPos]
                            : generateRandomEmail();
                        
                        // Add to the beginning of sentEmails array
                        sentEmails.unshift({
                            email: email,
                            timestamp: emailTimestamp.toISOString()
                        });
                    }
                }, i * 30);
            }
            
            // Make sure we don't exceed our limit
            if (sentEmails.length > 100) {
                sentEmails = sentEmails.slice(0, 100);
            }
            
            // Update the email list display with the new emails
            updateEmailListDisplay();
            
            // Save updated state
            savePersistenceData();
        }
    }
    
    // Handle page visibility change and beforeunload
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            // Save current state and timestamp before hiding
            savePersistenceData();
            stopDistribution();
        } else {
            // Resume if not already running
            if (!isCampaignRunning) {
                // Handle time passed while page was hidden
                handleTimePassed();
                distributeEmails();
            }
        }
    });
    
    // Save state before page unload
    window.addEventListener('beforeunload', function() {
        savePersistenceData();
    });
});