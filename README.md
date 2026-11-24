# DeskOps — Phase 1: Ticketing Core

This is our team project for LogicVeda Phase 1. Follow these steps to download the project onto a Windows computer and start the backend using Docker.

## What you need

Install these programs first:

1. **Git for Windows** — downloads the project from GitHub.  
   [Download Git](https://git-scm.com/download/win)

2. **Docker Desktop** — builds and runs the project in containers.
   [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)

3. **Visual Studio Code** — recommended for opening and editing the project.  
   [Download Visual Studio Code](https://code.visualstudio.com/)

After installing Docker Desktop, open it and wait for it to finish starting.

## Step 1: Open the project repository

Click this link to open our team project on GitHub:

[DeskOps Ticketing Core repository](https://github.com/Ahmad-Teejay/deskops-ticketing-core)

## Step 2: Open PowerShell

1. Click the Windows **Start** button.
2. Type **PowerShell**.
3. Open **PowerShell**.

## Step 3: Choose where to save the project

For example, to save it in your Documents folder, enter this command and press **Enter**:

```powershell
cd $HOME\Documents
```

## Step 4: Clone the project onto your computer

Copy and run:

```powershell
git clone https://github.com/Ahmad-Teejay/deskops-ticketing-core.git
```

**Clone** means downloading a copy of the repository onto your computer. Git creates a folder named `deskops-ticketing-core`.

If PowerShell says `git` is not recognized, install Git for Windows, close PowerShell, open it again, and retry.

## Step 5: Enter the project folder

Run:

```powershell
cd deskops-ticketing-core
```

You are now inside the project folder. Run the Docker commands below from here.

## Step 6: Open the project in Visual Studio Code

Run:

```powershell
code .
```

If PowerShell says `code` is not recognized:

1. Open Visual Studio Code.
2. Select **File > Open Folder**.
3. Open the `deskops-ticketing-core` folder inside Documents.

## Step 7: Start the backend with Docker

Make sure Docker Desktop is open and running. In PowerShell, run:

```powershell
docker compose up --build
```

This command builds the backend image and starts the backend and database containers. The first run may take a few minutes while Docker downloads and builds the required components.

Keep this PowerShell window open while the backend is running. You should see a message that the server is running.

If PowerShell says `docker` is not recognized, open Docker Desktop, wait for it to start, then close and reopen PowerShell.

## Step 8: Check that the backend is working

Leave the Docker window running. Open a **second PowerShell window** and run:

```powershell
Invoke-RestMethod http://localhost:8081/api/v1/health
```

A working backend returns information like:

```text
status  service
------  -------
UP      DeskOps Ticketing Core
```

You can also open this address in a browser:

[http://localhost:8081/api/v1/health](http://localhost:8081/api/v1/health)

This health check confirms that the backend is responding.

## Step 9: Stop the backend

Return to the first PowerShell window where Docker is running. Press **Ctrl+C**, then run:

```powershell
docker compose down
```

This stops the project’s containers.

## Get the latest team changes later

If you already cloned the project and want to download changes your teammates have added, open PowerShell in the project folder and run:

```powershell
git switch main
git pull
```

## Start work on an assigned task

Before editing, update your local `main` branch:

```powershell
git switch main
git pull
```

Create a separate branch for your assigned task. Replace `short-task-name` with a short description of your work:

```powershell
git switch -c feature/short-task-name
```

For example:

```powershell
git switch -c feature/ticket-comments
```

Make and save your changes in Visual Studio Code.

## Save and share your changes

See which files you changed:

```powershell
git status
```

Stage your changes:

```powershell
git add .
```

Save them as a commit, replacing the message with a short description of your work:

```powershell
git commit -m "Describe the change"
```

For example:

```powershell
git commit -m "Add ticket comments endpoint"
```

Push your branch to GitHub. Use the branch name you created:

```powershell
git push -u origin feature/short-task-name
```

## Open a pull request for review

1. Open the repository on GitHub.
2. Click **Compare & pull request** for your branch. If you don’t see the button, open **Pull requests** and click **New pull request**.
3. Set **base** to `main`.
4. Set **compare** to your feature branch.
5. Review the changes shown, then click **Create pull request**.
6. Ask a teammate to review it. Wait for the required approval and checks before merging.

A pull request lets teammates review your work before it is added to the shared `main` branch.

## Backend CI checks

The GitHub Actions workflow is in `.github/workflows/backend-ci.yml`. It runs automatically when someone pushes to `main` or opens a pull request targeting `main`.

The workflow checks the backend TypeScript code and builds the Docker image. To see whether it passed, open the repository on GitHub and select **Actions**.

### Run the same checks locally

From the project folder, open PowerShell and run:

```powershell
cd backend
npm ci
npm run typecheck
docker build -t deskops-ticketing-core-backend .
```