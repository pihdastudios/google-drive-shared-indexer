function shortcutEnterpriseSafe() {
  // --- CONFIGURATION ---
  var TARGET_FOLDER_ID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaa"; // Change me
  var MAX_EXECUTION_TIME = 1680000; // 28 Minutes
  // ---------------------

  var userProperties = PropertiesService.getUserProperties();
  var targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  
  // --- MEMORY SYSTEM ---
  // We now store two maps: 
  // 1. processedIds (to skip items we did)
  // 2. usedNames (to track duplicate names like "Reports")
  
  var memoryState = { processedIds: {}, usedNames: {} };
  var memoryFileId = userProperties.getProperty('MEMORY_FILE_ID');
  
  // Load Memory
  if (memoryFileId) {
    try {
      var content = DriveApp.getFileById(memoryFileId).getBlob().getDataAsString();
      memoryState = JSON.parse(content);
      console.log("Memory Loaded. items processed: " + Object.keys(memoryState.processedIds).length);
    } catch (e) {
      console.log("Starting fresh memory.");
    }
  }

  // Helper: Generate Unique Name
  function getUniqueName(originalName) {
    if (!memoryState.usedNames[originalName]) {
      // Name hasn't been used yet
      memoryState.usedNames[originalName] = 1;
      return originalName;
    } else {
      // Name exists! Increment counter
      var count = memoryState.usedNames[originalName];
      memoryState.usedNames[originalName] = count + 1;
      return originalName + " (" + count + ")";
    }
  }

  // Helper: Save State
  function saveState(token, currentPhase) {
    if (token) userProperties.setProperty('CONTINUATION_TOKEN', token);
    userProperties.setProperty('CURRENT_PHASE', currentPhase);
    
    var jsonContent = JSON.stringify(memoryState);
    if (memoryFileId) {
      DriveApp.getFileById(memoryFileId).setContent(jsonContent);
    } else {
      var file = targetFolder.createFile('script_memory.json', jsonContent, MimeType.PLAIN_TEXT);
      userProperties.setProperty('MEMORY_FILE_ID', file.getId());
    }
    console.log("Progress Saved.");
  }

  // State Variables
  var continuationToken = userProperties.getProperty('CONTINUATION_TOKEN');
  var phase = userProperties.getProperty('CURRENT_PHASE') || 'FOLDERS';
  var startTime = new Date().getTime();
  var count = 0;

  console.log("--- STARTING PHASE: " + phase + " ---");

  // =========================================
  // PHASE 1: FOLDERS
  // =========================================
  if (phase === 'FOLDERS') {
    var folderQuery = "(sharedWithMe = true or not 'me' in owners) and trashed = false";
    var folders;
    
    if (continuationToken) {
      folders = DriveApp.continueFolderIterator(continuationToken);
    } else {
      folders = DriveApp.searchFolders(folderQuery);
    }

    while (folders.hasNext()) {
      if (new Date().getTime() - startTime > MAX_EXECUTION_TIME) {
        saveState(folders.getContinuationToken(), 'FOLDERS');
        console.log("TIMEOUT (28 Mins). Run again.");
        return;
      }

      try {
        var folder = folders.next();
        var currentFolder = folder;
        
        // Climb Logic
        while (true) {
          try {
            var parents = currentFolder.getParents();
            if (parents.hasNext()) {
              var parent = parents.next();
              if (parent.getId() === DriveApp.getRootFolder().getId()) break; 
              if (parent.getId() === TARGET_FOLDER_ID) break;
              currentFolder = parent;
            } else { break; }
          } catch (e) { break; }
        }

        var rootId = currentFolder.getId();
        
        // Only process if ID is new
        if (!memoryState.processedIds[rootId]) {
          memoryState.processedIds[rootId] = true;
          
          // GENERATE UNIQUE NAME
          var safeName = getUniqueName(currentFolder.getName());
          
          var s = DriveApp.createShortcut(rootId);
          s.moveTo(targetFolder);
          s.setName(safeName); // Apply the unique name (e.g., "Reports (1)")
          
          count++;
          console.log("Shortcut: " + safeName);
        }
      } catch (e) { console.log("Error: " + e.message); }
    }
    
    // Transition
    userProperties.deleteProperty('CONTINUATION_TOKEN');
    saveState(null, 'FILES');
    phase = 'FILES'; 
  }

// =========================================
  // PHASE 2: FILES (Self-Healing Structure)
  // =========================================
  if (phase === 'FILES') {
    var fileQuery = "not 'me' in owners and trashed = false";
    var files;
    
    continuationToken = userProperties.getProperty('CONTINUATION_TOKEN');
    if (continuationToken) {
      files = DriveApp.continueFileIterator(continuationToken);
    } else {
      files = DriveApp.searchFiles(fileQuery);
    }

    while (files.hasNext()) {
      if (new Date().getTime() - startTime > MAX_EXECUTION_TIME) {
        saveState(files.getContinuationToken(), 'FILES');
        console.log("TIMEOUT (28 Mins in Files). Run again.");
        return;
      }

      try {
        var file = files.next();
        var isCovered = false;
        var highestAccessibleParent = null; // We will track the top-most folder we find

        // --- CLIMBING CHECK ---
        var parents = file.getParents();
        if (parents.hasNext()) {
          var currentFolder = parents.next();
          
          while (true) {
            // 1. Is this folder already processed?
            if (memoryState.processedIds[currentFolder.getId()]) {
              isCovered = true;
              break; 
            }
            
            // 2. If not processed, track it as a candidate to shortcut
            highestAccessibleParent = currentFolder;

            // 3. Try to climb higher
            try {
              var grandParents = currentFolder.getParents();
              if (grandParents.hasNext()) {
                var nextParent = grandParents.next();
                var pId = nextParent.getId();
                
                // Stop at Root or Target
                if (pId === DriveApp.getRootFolder().getId()) break;
                if (pId === TARGET_FOLDER_ID) break;
                
                currentFolder = nextParent;
              } else {
                break; // Reached top
              }
            } catch (e) {
              break; // Access denied to higher levels
            }
          }
        }
        // ----------------------

        if (!isCovered) {
          // STRATEGY: If we found a parent folder, shortcut THAT instead of the file.
          // This restores the folder structure for items Phase 1 missed.
          
          if (highestAccessibleParent) {
            var parentId = highestAccessibleParent.getId();
            
            // Double check: make sure we didn't JUST add it in this loop cycle
            if (!memoryState.processedIds[parentId]) {
              memoryState.processedIds[parentId] = true; // Mark folder as done
              
              var safeName = getUniqueName(highestAccessibleParent.getName());
              var s = DriveApp.createShortcut(parentId);
              s.moveTo(targetFolder);
              s.setName(safeName);
              
              count++;
              console.log("RESCUED FOLDER: " + safeName + " (Found via file: " + file.getName() + ")");
            }
          } else {
            // No accessible parent? Shortcut the file itself (Orphan).
            var safeName = getUniqueName(file.getName());
            var s = DriveApp.createShortcut(file.getId());
            s.moveTo(targetFolder);
            s.setName(safeName);
            count++;
            console.log("Shortcut File (Orphan): " + safeName);
          }
        }
      } catch (e) {}
    }
    
    console.log("--- DONE ---");
    // Clear memory so you can run it fresh next time
    userProperties.deleteAllProperties();
    if (memoryFileId) {
       try { DriveApp.getFileById(memoryFileId).setTrashed(true); } catch(e){}
    }
  }
}

function removeRedundantShortcuts() {
  var TARGET_FOLDER_ID = "14WDmCm6luGQ61klgFr68jcHvnCixh6yg"; 
  var targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  
  var shortcuts = [];
  var files = targetFolder.getFiles();
  
  // 1. Collect all shortcuts in the folder
  while (files.hasNext()) {
    var file = files.next();
    if (file.getMimeType() === 'application/vnd.google-apps.shortcut') {
      try {
        var targetId = file.getTargetId();
        shortcuts.push({
          shortcutFile: file,
          targetId: targetId,
          name: file.getName()
        });
      } catch (e) {
        // Target might be trashed or lost permissions
      }
    }
  }

  console.log("Found " + shortcuts.length + " shortcuts. Checking for redundancy...");

  // 2. Check for "Parent-Child" redundancy
  // We need to see if Target A is actually inside Target B.
  // Since we can't easily check paths without API calls, we do a basic check:
  // Does Shortcut A point to a folder that is inside Shortcut B's target?

  // This is slow/hard to do perfectly in script without climbing again.
  // SIMPLER FIX: Check for exact ID duplicates (if the script ran twice).
  
  var seenIds = {};
  var deletedCount = 0;

  for (var i = 0; i < shortcuts.length; i++) {
    var s = shortcuts[i];
    
    if (seenIds[s.targetId]) {
      // We already have a shortcut pointing to this exact same folder/file
      console.log("Duplicate found: " + s.name + " -> Deleting copy.");
      s.shortcutFile.setTrashed(true);
      deletedCount++;
    } else {
      seenIds[s.targetId] = true;
    }
  }
  
  console.log("Clean up complete. Removed " + deletedCount + " exact duplicates.");
}

function resetScriptMemory() {
  var userProperties = PropertiesService.getUserProperties();
  
  // 1. Try to delete the actual file in Drive
  var fileId = userProperties.getProperty('MEMORY_FILE_ID');
  if (fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
      console.log("Deleted old memory file: " + fileId);
    } catch (e) {
      console.log("Could not delete file (maybe already gone): " + e.message);
    }
  }
  
  // 2. Clear the internal settings
  userProperties.deleteAllProperties();
  console.log("--- MEMORY WIPED CLEAN ---");
  console.log("You can now run 'shortcutEnterpriseSafe' without errors.");
}
