document.addEventListener('DOMContentLoaded', function() {
    // Set default options if not already set
    chrome.storage.sync.get({
        outputType: 'clipboard',
        fileFormat: 'srt',
        includeTimestamp: true
    }, function(items) {
        // Save default settings
        chrome.storage.sync.set(items, function() {
            // After saving, load the settings into the UI
            document.getElementById('outputType').value = items.outputType;
            document.getElementById('fileFormat').value = items.fileFormat;
            document.getElementById('includeTimestamp').checked = items.includeTimestamp;
            
            // Show/hide file format based on output type
            handleOutputTypeChange();
        });
    });

    // Save settings when changed
    document.getElementById('outputType').addEventListener('change', function(e) {
        saveOption('outputType', e.target.value);
        handleOutputTypeChange();
    });

    document.getElementById('fileFormat').addEventListener('change', function(e) {
        saveOption('fileFormat', e.target.value);
    });

    document.getElementById('includeTimestamp').addEventListener('change', function(e) {
        saveOption('includeTimestamp', e.target.checked);
    });
});

// Function to handle output type change
function handleOutputTypeChange() {
    const outputType = document.getElementById('outputType').value;
    const fileFormatGroup = document.getElementById('fileFormatGroup');
    
    if (outputType === 'file') {
        fileFormatGroup.style.display = 'flex';
        setTimeout(() => {
            fileFormatGroup.style.opacity = '1';
            fileFormatGroup.style.transform = 'translateY(0)';
        }, 50);
    } else {
        fileFormatGroup.style.opacity = '0';
        fileFormatGroup.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            fileFormatGroup.style.display = 'none';
        }, 300);
    }
}

// Function to save individual options
function saveOption(key, value) {
    chrome.storage.sync.set({ [key]: value }, function() {
        showSaveStatus();
    });
}

// Function to show save status
function showSaveStatus() {
    const status = document.getElementById('status');
    status.style.display = 'block';
    status.style.opacity = '0';
    status.style.transform = 'translateY(20px) translateX(-50%)';
    
    requestAnimationFrame(() => {
        status.style.opacity = '1';
        status.style.transform = 'translateY(0) translateX(-50%)';
    });

    setTimeout(function() {
        status.style.opacity = '0';
        status.style.transform = 'translateY(-20px) translateX(-50%)';
        setTimeout(() => {
            status.style.display = 'none';
        }, 300);
    }, 2000);
} 