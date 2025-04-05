# Image Search App with OCR

A lightweight application that lets you scan and search your local images using OCR (Optical Character Recognition). Find any document or image based on the text it contains, even if the filename doesn't describe the content.

## 🔍 What It Does

Have you ever struggled to find a document or screenshot in your folders? This app solves that problem by:

1. Scanning all images in a folder
2. Performing OCR to extract text from each image
3. Indexing this text in a local database
4. Providing a simple search interface to find images by their content

### Key Features

- **Text-based Image Search**: Find images by what's in them, not just by filename
- **Document Detection**: Automatically identifies images that contain documents
- **Offline-First**: Works completely offline - your images never leave your computer
- **Fast Search**: Uses SQLite FTS5 for quick and efficient text searching
- **Fuzzy Matching**: Smart search that handles typos and word variations
- **Simple UI**: Clean interface for scanning folders and viewing results

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) - The JavaScript runtime used by this app

### Installation

1. Install Bun if you haven't already:

```bash
# On macOS, Linux, and WSL
curl -fsSL https://bun.sh/install | bash

# On Windows via PowerShell
powershell -c "irm bun.sh/install.ps1 | iex"
```

2. Clone this repository:

```bash
git clone https://github.com/biohacker0/ImageSearch.git
cd ImageSearch
```

3. Install dependencies:

```bash
bun install
```

4. Start the application:

```bash
bun start
```

5. Open your browser and go to:

```
http://localhost:3000
```

## 📖 How to Use

### Scanning Images

1. Enter the full path to a folder containing images in the "Scan Folder" field
2. Click "Scan Images"
3. Wait for the scanning process to complete
   - This might take a while for folders with many images
   - The app will extract text from each image using OCR

### Searching for Images

1. Type a search term in the search box
2. Click "Search" or press Enter
3. View the results that match your search

The search is smart enough to:

- Handle partial matches and word variations
- Find text even if it's split across lines
- Match documents with spelling variations
- Rank results by relevance

### Command Line Usage

You can also use the app from the command line:

```bash
# Scan a folder
bun app.js scan "/path/to/your/images"

# Search for images
bun app.js search "id card"
```

## 🔧 How It Works

### Technical Overview

1. **OCR Engine**: Tesseract.js is used to extract text from images
2. **Database**: SQLite with FTS5 extension for full-text search
3. **Server**: Bun's built-in HTTP server
4. **Frontend**: Simple HTML/CSS/JS for the user interface

### Search Algorithm

The search uses a multi-tiered approach:

1. First tries exact phrase matching
2. If no results, tries matching any of the search terms
3. For poor results, falls back to a custom fuzzy matching algorithm
4. Text is normalized and preprocessed for better matching

## 🔄 Limitations & Future Improvements

Current limitations:

- OCR can be slow on large images
- Limited language support (currently English-focused)
- No batch processing for large collections

Planned improvements:

- Multi-language OCR support
- Image preprocessing to improve OCR quality
- Performance optimizations for large collections
- More advanced search capabilities

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 💡 Idea & Motivation

This project was created to solve the problem of finding documents and screenshots on personal devices. With modern smartphones and computers, we take countless screenshots and save documents, but finding them later becomes a challenge.

While cloud services like Google Photos provide text search for images, there was no good offline solution that respects privacy while providing the same functionality.

The app uses OCR to analyze images once, saving the extracted text locally. This lets you search through your personal image collection quickly without uploading anything to external services.
