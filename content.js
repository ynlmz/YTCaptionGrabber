// Wait for YouTube's player to be ready
let lastUrl = location.href;
let subtitleButton = null;
let lastVideoId = null;

// Function to create the subtitle button
function createSubtitleButton() {
    const button = document.createElement('button');
    button.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M20,4H4C2.9,4,2,4.9,2,6v12c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V6C22,4.9,21.1,4,20,4z M4,12h4v2H4V12z M10,12h4v2h-4V12z M16,16H4v-2h12V16z M20,16h-4v-2h4V16z M20,12h-4v-2h4V12z"/>
        </svg>
        Extract Subtitles
    `;
    button.className = 'ytp-subtitle-extract-button';
    return button;
}

// Function to process subtitles based on settings
function processSubtitles(subtitleText, settings) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(subtitleText, 'text/xml');
    const textNodes = doc.getElementsByTagName('text');
    let output = '';

    // Helper function to decode HTML entities
    const decodeHTML = (text) => {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    };

    if (settings.fileFormat === 'srt' && settings.includeTimestamp) {
        // Convert to SRT format with timestamps
        Array.from(textNodes).forEach((node, index) => {
            const start = formatTime(parseFloat(node.getAttribute('start')));
            const duration = parseFloat(node.getAttribute('dur') || '0');
            const end = formatTime(parseFloat(node.getAttribute('start')) + duration);
            
            output += `${index + 1}\n`;
            output += `${start} --> ${end}\n`;
            output += `${decodeHTML(node.textContent)}\n\n`;
        });
    } else if (settings.fileFormat === 'vtt' && settings.includeTimestamp) {
        // Convert to VTT format with timestamps
        output = 'WEBVTT\n\n';
        Array.from(textNodes).forEach((node) => {
            const start = formatTimeVTT(parseFloat(node.getAttribute('start')));
            const duration = parseFloat(node.getAttribute('dur') || '0');
            const end = formatTimeVTT(parseFloat(node.getAttribute('start')) + duration);
            
            output += `${start} --> ${end}\n`;
            output += `${decodeHTML(node.textContent)}\n\n`;
        });
    } else {
        // Plain text format (txt)
        Array.from(textNodes).forEach(node => {
            if (settings.includeTimestamp) {
                const start = formatTime(parseFloat(node.getAttribute('start')));
                output += `[${start}] `;
            }
            output += `${decodeHTML(node.textContent)}\n`;
        });
    }

    return output;
}

// Helper function to format time for SRT
function formatTime(seconds) {
    const pad = (num) => num.toString().padStart(2, '0');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${ms.toString().padStart(3, '0')}`;
}

// Helper function to format time for VTT
function formatTimeVTT(seconds) {
    const pad = (num) => num.toString().padStart(2, '0');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${ms.toString().padStart(3, '0')}`;
}

// Function to get available subtitle tracks
async function getSubtitleTracks() {
    try {
        // Get video ID from URL
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) return null;

        // Clear cache if video changed
        if (lastVideoId !== videoId) {
            lastVideoId = videoId;
            delete window.ytInitialPlayerResponse;
        }

        // Try to get player data from the movie_player element (most reliable for video changes)
        const moviePlayer = document.getElementById('movie_player');
        if (moviePlayer && moviePlayer.getPlayerResponse) {
            const playerResponse = moviePlayer.getPlayerResponse();
            if (playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
                return playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
            }
        }

        // Try to get from the page source
        const ytInitialData = document.body.innerHTML.match(/ytInitialPlayerResponse\s*=\s*({.+?});/)?.[1];
        if (ytInitialData) {
            try {
                const data = JSON.parse(ytInitialData);
                if (data?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
                    return data.captions.playerCaptionsTracklistRenderer.captionTracks;
                }
            } catch (e) {
                console.error('Error parsing ytInitialData:', e);
            }
        }

        // If all methods fail, try to fetch the video page
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            cache: 'no-store',  // Prevent caching
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const html = await response.text();
        const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match) {
            const data = JSON.parse(match[1]);
            if (data?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
                return data.captions.playerCaptionsTracklistRenderer.captionTracks;
            }
        }

        return null;
    } catch (error) {
        console.error('Error fetching subtitle tracks:', error);
        return null;
    }
}

// Function to extract subtitles
async function extractSubtitles() {
    try {
        // Get settings from storage
        const settings = await chrome.storage.sync.get({
            outputType: 'clipboard',
            fileFormat: 'srt',
            includeTimestamp: true
        });

        // Get subtitle tracks
        const tracks = await getSubtitleTracks();
        if (!tracks || tracks.length === 0) {
            alert('No subtitles available for this video');
            return;
        }

        // Use the first available track
        const track = tracks[0];
        
        // Fetch subtitle data with no-cache
        const response = await fetch(track.baseUrl, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const subtitleText = await response.text();
        
        // Process subtitles based on settings
        const processedSubtitles = processSubtitles(subtitleText, settings);

        if (settings.outputType === 'clipboard') {
            // Copy to clipboard
            await navigator.clipboard.writeText(processedSubtitles);
            showNotification('Subtitles copied to clipboard!');
        } else {
            // Download as file
            const blob = new Blob([processedSubtitles], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const videoTitle = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || 'subtitles';
            a.href = url;
            a.download = `${videoTitle}.${settings.fileFormat}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification('Subtitles downloaded successfully!');
        }
    } catch (error) {
        console.error('Error processing subtitles:', error);
        alert('Failed to process subtitles. Please try again.');
    }
}

// Function to show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'subtitle-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Fade in
    setTimeout(() => {
        notification.classList.add('show');
    }, 50);

    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Function to inject button
function injectButton() {
    // Remove any existing buttons first
    const existingButtons = document.querySelectorAll('.ytp-subtitle-extract-button');
    existingButtons.forEach(button => button.remove());

    // Look for the title container
    const titleContainer = document.querySelector('#above-the-fold #title');
    
    if (!titleContainer) {
        // If injection point isn't ready, retry after a delay
        setTimeout(injectButton, 1000);
        return;
    }

    // Add class to title container for positioning context
    titleContainer.classList.add('title-container-with-button');

    // Create and add the button
    subtitleButton = createSubtitleButton();
    subtitleButton.addEventListener('click', extractSubtitles);
    titleContainer.appendChild(subtitleButton);
}

// Watch for page navigation and DOM changes
const observer = new MutationObserver((mutations) => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (location.pathname === '/watch') {
            setTimeout(injectButton, 1000);
        }
    } else if (location.pathname === '/watch') {
        // Check if our button is still present and in the correct place
        const existingButton = document.querySelector('.ytp-subtitle-extract-button');
        const titleContainer = document.querySelector('#above-the-fold #title h1.ytd-watch-metadata');
        if (!existingButton && titleContainer) {
            setTimeout(injectButton, 1000);
        }
    }
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial injection
if (location.pathname === '/watch') {
    setTimeout(injectButton, 1000);
} 