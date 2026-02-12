# Google Drive Shared Indexer (for Rclone)

> "Mostly made with AI Slop" — but it works.

## 🎯 The Goal

Tools like **rclone** are fantastic, but scanning the entire "Shared with me" section of Google Drive can be messy, slow, or result in missing files.

This script solves that by:

1. Scanning everything shared with you.
2. Determining the root folder of shared structures (to preserve hierarchy).
3. Creating **Shortcuts** to those items in a single, clean "Target Folder."
4. **Result:** You can simply point rclone at this one Target Folder to download/sync everything cleanly.

## ✨ Features

* **Enterprise/Education Ready:** Handles Google's script execution time limits (6 min for free users, 30 min for workspace). It saves its state and resumes exactly where it left off.
* **Smart "Climbing":** If you have a file shared with you, it checks if the *parent folder* is also shared. If so, it shortcuts the folder instead of the file, keeping your directory structure intact.
* **Duplicate Name Handling:** Automatically renames conflicts (e.g., `Report`, `Report (1)`, `Report (2)`).
* **Memory System:** Uses a JSON file to track what has already been processed to prevent duplicates on subsequent runs.

## 🚀 Setup

1. **Create a Target Folder:**
* Create a new folder in your Google Drive (e.g., `_Shared_Index`).
* Open the folder and look at the URL. Copy the ID (the long string of gibberish after `folders/`).
* *Example:* `https://drive.google.com/drive/folders/12345ABCDE...` -> ID is `12345ABCDE...`


2. **Install the Script:**
* Go to [script.google.com](https://script.google.com/).
* Create a **New Project**.
* Paste the code into the editor.


3. **Configure:**
* Look for the `CONFIGURATION` section at the top of `shortcutEnterpriseSafe`.
* Replace `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaa` with your **Target Folder ID**.
* **Adjust Time:**
* Free Gmail accounts: Set `MAX_EXECUTION_TIME` to `300000` (5 mins).
* Workspace/Edu accounts: Set `MAX_EXECUTION_TIME` to `1680000` (28 mins).





## 🏃‍♂️ Usage

### The Main Process

1. Select `shortcutEnterpriseSafe` from the function dropdown menu.
2. Click **Run**.
3. **Grant Permissions** when asked.
4. **Watch the Logs:**
* If the script hits the time limit, it will log `TIMEOUT. Run again.`
* **Rerun the script.** It will load "Memory" and continue where it left off.
* Repeat this until you see `--- DONE ---`.



### Maintenance Functions

* **`resetScriptMemory`**:
* Run this if the script gets stuck or if you want to start a brand new index from scratch. It deletes the temporary memory file and script properties.


* **`removeRedundantShortcuts`**:
* Run this occasionally to clean up exact duplicate shortcuts if you accidentally ran the script multiple times without memory.



## 🛠️ Post-Processing (Rclone)

Once the script is finished, you can use rclone to download or sync the content.

```bash
# Example rclone command
rclone copy "gdrive:/_Shared_Index" /local/path --drive-shared-with-me --transfers=10

```

*Note: Since these are shortcuts, rclone treats them transparently as the files they point to.*

## 📄 License

**MIT License**

Copyright (c) 2026 Pihdastudios

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.