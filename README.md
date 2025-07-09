# CloudSync

A GUI control panel for macOS to manage and enhance your `rclone` synchronization tasks, specifically designed to keep your `Documents` folder in sync across multiple machines via the cloud.

CloudSync provides a user-friendly interface to control complex `rclone` operations, giving you visibility and fine-grained control over your cloud backups without needing to memorize command-line flags.

## Key Features

* **Simple Interface:** A clean and modern UI to manage sync operations.
* **Bidirectional Sync:** Safely perform two-way syncs (`bisync`) between your local files and cloud storage.
* **Dry-Run Mode:** Preview exactly what files will be changed, moved, or deleted before committing to a sync.
* **Conflict & Deletion Protection:** Automatically back up conflicting files and archive deleted files to prevent data loss.
* **Safety Limits:** Set a maximum number of files that can be deleted in a single operation to protect against mistakes.
* **Advanced Controls:** Configure options like auto-retries, bandwidth limits, and verbose logging directly from the UI.
* **Live Progress:** View real-time progress bars and a detailed log output for active sync operations.

## Keyboard Shortcuts

You can use standard keyboard shortcuts to adjust the application's zoom level for your comfort.

* **Zoom In:** `Command` + `+`
* **Zoom Out:** `Command` + `-`
* **Reset Zoom:** `Command` + `0`

## How It Works: The Documents Workflow

This application is specifically designed to sync one folder only: your local **`~/Documents`** folder.

* It syncs this folder to a corresponding **`Documents`** folder on your configured cloud remote (e.g., on Google Drive).
* You must ensure that a `Documents` folder exists in the root of your cloud drive before the first sync.

## Syncing Multiple Macs

You can install CloudSync on multiple Mac computers to keep their respective `Documents` folders synchronized with the single central `Documents` folder in your cloud storage.

> **⚠️ Important Warning**
>
> To avoid file conflicts and potential data loss, you must **only run a sync operation from one machine at a time**. Do not run the app simultaneously on multiple computers.

## Requirements

1.  **macOS:** This application is built for macOS.
2.  **Rclone Configuration:** CloudSync includes `rclone` inside the app, so no separate installation is needed. However, you must configure `rclone` once to connect it to your cloud accounts.

## Installation

1.  Download the latest release from the (https://github.com/dhawgood/CloudSync/releases).
2.  Open the `.dmg` file.
3.  Drag the `CloudSync` application into your `Applications` folder.

## Getting Started

1.  **Configure Rclone:** If you have never used `rclone` before, open your Mac's **Terminal** app and run the following command:
    ```bash
    rclone config
    ```
    This will launch a setup wizard that will guide you through connecting to your cloud storage (e.g., Google Drive, Dropbox).

2.  **Install and Launch CloudSync:** After configuring rclone, open the `CloudSync` app from your Applications folder.

3.  **Run a Sync:** Choose your desired options from the main window and click the "Run Sync" button to begin.

## License

This project is licensed under the MIT License. See the (LICENSE) file for details.
