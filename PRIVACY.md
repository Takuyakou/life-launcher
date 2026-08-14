# Privacy

Life Launcher is designed as a local-first Windows desktop application.

## Data Stored Locally

The application may store launcher configuration, timer sessions, daily notes, configuration backups, and cached launcher icons or favicons under `%APPDATA%\life-launcher`.

An optional backup destination can also be selected by the user. Life Launcher does not upload these files to a Life Launcher account or server.

## Network Activity

Life Launcher does not include telemetry, analytics, advertising, crash reporting, cloud sync, or an automatic updater.

Network access can occur when the application retrieves a favicon for a URL that the user registers. The request is made directly to the registered site's origin; no third-party favicon API is used. The fetch is bounded and rejects obvious local or private network destinations.

Opening a registered web link starts the user's configured browser. Any subsequent browser network traffic is controlled by that browser and its settings.

## User Control

Users can inspect or remove local application data and can choose whether to configure backup and instruction folders. Uninstalling the executable does not necessarily remove the local data directory.