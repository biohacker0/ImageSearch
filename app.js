// import { Database } from "bun:sqlite";
// import { readdirSync, statSync } from "fs";
// import { join, basename } from "path";
// import Tesseract from "tesseract.js";
// import { serve } from "bun";

// // Initialize database
// const db = new Database("images.sqlite", { create: true });

// // Create tables if they don't exist
// db.exec(`
//   CREATE TABLE IF NOT EXISTS images (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     path TEXT NOT NULL,
//     filename TEXT NOT NULL,
//     ocr_text TEXT,
//     is_document BOOLEAN,
//     thumbnail BLOB,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//   );

//   -- For full-text search
//   CREATE VIRTUAL TABLE IF NOT EXISTS image_fts USING fts5(
//     ocr_text,
//     content='images',
//     content_rowid='id'
//   );
// `);

// // OCR throught every single image we have in the given path
// async function processImage(imagePath) {
//   console.log(`Processing ${imagePath}...`);

//   try {
//     // Perform OCR with Tesseract.js
//     const result = await Tesseract.recognize(imagePath, "eng", {
//       logger: (m) => console.log(m),
//     });

//     const ocrText = result.data.text;
//     const isDocument = result.data.confidence > 60; // Higher threshold for documents

//     // Normalize text for better searching
//     const normalizedText = normalizeText(ocrText);

//     // Save to database
//     const filename = basename(imagePath);
//     const stmt = db.prepare("INSERT INTO images (path, filename, ocr_text, is_document) VALUES (?, ?, ?, ?)");
//     const info = stmt.run(imagePath, filename, normalizedText, isDocument);

//     // Add to FTS table
//     db.prepare("INSERT INTO image_fts(rowid, ocr_text) VALUES (?, ?)").run(info.lastInsertRowid, normalizedText);

//     return {
//       id: info.lastInsertRowid,
//       path: imagePath,
//       filename,
//       is_document: isDocument,
//     };
//   } catch (error) {
//     console.error(`Error processing ${imagePath}:`, error);
//     return null;
//   }
// }

// // Process a folder of images
// async function processFolder(folderPath) {
//   console.log(`Scanning folder: ${folderPath}`);
//   const files = readdirSync(folderPath);
//   const results = [];

//   for (const file of files) {
//     const fullPath = join(folderPath, file);

//     if (statSync(fullPath).isDirectory()) {
//       const subResults = await processFolder(fullPath);
//       results.push(...subResults);
//       continue;
//     }

//     // Skip if current file is not an image
//     if (!file.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) continue;

//     // Check if this image is already in database , so we dont duplicate stuff
//     const existing = db.query("SELECT id FROM images WHERE path = ?").get(fullPath);
//     if (existing) {
//       results.push({ id: existing.id, path: fullPath, filename: file, exists: true });
//       continue;
//     }

//     const result = await processImage(fullPath);
//     if (result) results.push(result);
//   }

//   return results;
// }

// // Search for images based on text query
// function searchImages(query) {
//   const normalizedQuery = normalizeText(query);

//   // Split the query into words / tokenize
//   const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);

//   if (words.length === 0) {
//     return [];
//   }

//   // For single word queries, we can use direct matching with wildcard
//   if (words.length === 1) {
//     return db
//       .query(
//         `
//       SELECT images.*
//       FROM image_fts
//       JOIN images ON image_fts.rowid = images.id
//       WHERE image_fts MATCH ?
//       ORDER BY rank
//     `
//       )
//       .all(words[0] + "*"); // Wildcard suffix for partial matching
//   }

//   // For multi-word queries, we need a more advanced approach

//   // 1. Try exact phrase matching first
//   const exactResults = db
//     .query(
//       `
//     SELECT images.*
//     FROM image_fts
//     JOIN images ON image_fts.rowid = images.id
//     WHERE image_fts MATCH ?
//     ORDER BY rank
//   `
//     )
//     .all(`"${normalizedQuery}"`); // Quoted for phrase search

//   if (exactResults.length > 0) {
//     return exactResults;
//   }

//   // 2. Use an OR query with the FTS5 syntax
//   // Build a search term like: word1* OR word2* OR word3*
//   const searchTerm = words.map((word) => word + "*").join(" OR ");

//   const orResults = db
//     .query(
//       `
//     SELECT images.*
//     FROM image_fts
//     JOIN images ON image_fts.rowid = images.id
//     WHERE image_fts MATCH ?
//     ORDER BY rank
//   `
//     )
//     .all(searchTerm);

//   // 3. Try advanced fuzzy matching for poor results
//   if (orResults.length < 3) {
//     return fuzzySearchFallback(normalizedQuery);
//   }

//   return orResults;
// }

// // Fallback fuzzy search for when standard FTS doesn't give good results
// function fuzzySearchFallback(query) {
//   console.log("Using fuzzy search fallback for:", query);

//   // Get all images - only do this for small-to-medium sized databases
//   const allImages = db.query("SELECT * FROM images").all();

//   // Calculate how similar each image's OCR text is to the query
//   return allImages
//     .map((img) => {
//       // Calculate similarity score (higher is better)
//       const score = calculateSimilarity(img.ocr_text, query);
//       return { ...img, score };
//     })
//     .filter((img) => img.score > 0.3) // Only keep reasonable matches
//     .sort((a, b) => b.score - a.score); // Sort by score descending
// }

// // Simple text similarity function
// function calculateSimilarity(text, query) {
//   if (!text) return 0;

//   const textLower = text.toLowerCase();
//   const queryLower = query.toLowerCase();

//   // Check for exact match
//   if (textLower.includes(queryLower)) {
//     return 1.0;
//   }

//   // Check for words that contain parts of the query
//   const queryWords = queryLower.split(/\s+/);
//   const textWords = textLower.split(/\s+/);

//   let matches = 0;

//   // For each query word, check if any text word contains it
//   queryWords.forEach((qWord) => {
//     if (qWord.length < 3) return; // Skip very short words

//     // Check if any word contains this query word
//     for (const tWord of textWords) {
//       // Check for containment
//       if (tWord.includes(qWord) || qWord.includes(tWord)) {
//         matches++;
//         break;
//       }

//       // Check for edit distance for longer words
//       if (qWord.length > 4 && tWord.length > 4) {
//         if (levenshteinDistance(qWord, tWord) <= 2) {
//           matches += 0.8; // Partial match
//           break;
//         }
//       }
//     }
//   });

//   // Calculate score based on how many query words matched
//   return queryWords.length > 0 ? matches / queryWords.length : 0;
// }

// // Levenshtein distance for fuzzy matching
// function levenshteinDistance(str1, str2) {
//   const track = Array(str2.length + 1)
//     .fill(null)
//     .map(() => Array(str1.length + 1).fill(null));

//   for (let i = 0; i <= str1.length; i++) {
//     track[0][i] = i;
//   }

//   for (let j = 0; j <= str2.length; j++) {
//     track[j][0] = j;
//   }

//   for (let j = 1; j <= str2.length; j++) {
//     for (let i = 1; i <= str1.length; i++) {
//       const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
//       track[j][i] = Math.min(
//         track[j][i - 1] + 1, // deletion
//         track[j - 1][i] + 1, // insertion
//         track[j - 1][i - 1] + indicator // substitution
//       );
//     }
//   }

//   return track[str2.length][str1.length];
// }

// // Helper to normalize text for better matching
// function normalizeText(text) {
//   return text.toLowerCase().replace(/\s+/g, " ").trim();
// }

// // API server
// const server = serve({
//   port: 3000,
//   async fetch(req) {
//     const url = new URL(req.url);

//     // API routes
//     if (url.pathname === "/api/scan") {
//       const { folder } = await req.json();
//       const results = await processFolder(folder);
//       return new Response(JSON.stringify(results), {
//         headers: { "Content-Type": "application/json" },
//       });
//     }

//     if (url.pathname === "/api/search") {
//       const { query } = await req.json();
//       const results = searchImages(query);
//       return new Response(JSON.stringify(results), {
//         headers: { "Content-Type": "application/json" },
//       });
//     }

//     if (url.pathname === "/api/image") {
//       const id = url.searchParams.get("id");
//       const image = db.query("SELECT * FROM images WHERE id = ?").get(id);

//       if (!image) {
//         return new Response("Image not found", { status: 404 });
//       }

//       // Return file
//       const file = Bun.file(image.path);
//       return new Response(file);
//     }

//     // Serve static files from public directory
//     const filePath = join(import.meta.dir, "public", url.pathname === "/" ? "index.html" : url.pathname);
//     const file = Bun.file(filePath);

//     if (await file.exists()) {
//       return new Response(file);
//     }

//     return new Response("Not found", { status: 404 });
//   },
// });

// console.log(`Server running at http://localhost:3000`);

// // CLI interface for testing
// if (process.argv.length > 2) {
//   const command = process.argv[2];

//   if (command === "scan" && process.argv.length > 3) {
//     const folder = process.argv[3];
//     processFolder(folder).then((results) => {
//       console.log(`Processed ${results.length} images`);
//       process.exit(0);
//     });
//   }

//   if (command === "search" && process.argv.length > 3) {
//     const query = process.argv[3];
//     const results = searchImages(query);
//     console.log(`Found ${results.length} results for "${query}":`);
//     results.forEach((img) => {
//       console.log(`- ${img.filename} (${img.path})`);
//     });
//     process.exit(0);
//   }
// }

// export { processFolder, searchImages };

import { Database } from "bun:sqlite";
import { readdirSync, statSync } from "fs";
import { join, basename } from "path";
import Tesseract from "tesseract.js";
import { serve } from "bun";
const uFuzzy = require("@leeoniya/ufuzzy");

// Initialize database
const db = new Database("images.sqlite", { create: true });

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    filename TEXT NOT NULL,
    ocr_text TEXT,
    is_document BOOLEAN,
    thumbnail BLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  -- For full-text search
  CREATE VIRTUAL TABLE IF NOT EXISTS image_fts USING fts5(
    ocr_text,
    content='images',
    content_rowid='id'
  );
`);

// OCR throught every single image we have in the given path
async function processImage(imagePath) {
  console.log(`Processing ${imagePath}...`);

  try {
    // Perform OCR with Tesseract.js
    const result = await Tesseract.recognize(imagePath, "eng", {
      logger: (m) => console.log(m),
    });

    const ocrText = result.data.text;
    const isDocument = result.data.confidence > 60; // Higher threshold for documents

    // Normalize text for better searching
    const normalizedText = normalizeText(ocrText);

    // Save to database
    const filename = basename(imagePath);
    const stmt = db.prepare("INSERT INTO images (path, filename, ocr_text, is_document) VALUES (?, ?, ?, ?)");
    const info = stmt.run(imagePath, filename, normalizedText, isDocument);

    // Add to FTS table
    db.prepare("INSERT INTO image_fts(rowid, ocr_text) VALUES (?, ?)").run(info.lastInsertRowid, normalizedText);

    return {
      id: info.lastInsertRowid,
      path: imagePath,
      filename,
      is_document: isDocument,
    };
  } catch (error) {
    console.error(`Error processing ${imagePath}:`, error);
    return null;
  }
}

// Process a folder of images
async function processFolder(folderPath) {
  console.log(`Scanning folder: ${folderPath}`);
  const files = readdirSync(folderPath);
  const results = [];

  for (const file of files) {
    const fullPath = join(folderPath, file);

    if (statSync(fullPath).isDirectory()) {
      const subResults = await processFolder(fullPath);
      results.push(...subResults);
      continue;
    }

    // Skip if current file is not an image
    if (!file.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) continue;

    // Check if this image is already in database , so we dont duplicate stuff
    const existing = db.query("SELECT id FROM images WHERE path = ?").get(fullPath);
    if (existing) {
      results.push({ id: existing.id, path: fullPath, filename: file, exists: true });
      continue;
    }

    const result = await processImage(fullPath);
    if (result) results.push(result);
  }

  return results;
}

// Search for images based on text query
function searchImages(query) {
  const normalizedQuery = normalizeText(query);

  // Split the query into words / tokenize
  const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return [];
  }

  let searchResults = [];

  try {
    // For single word queries, we can use direct matching with wildcard
    if (words.length === 1) {
      searchResults = db
        .query(
          `
        SELECT images.* 
        FROM image_fts 
        JOIN images ON image_fts.rowid = images.id
        WHERE image_fts MATCH ?
        ORDER BY rank
        LIMIT 100
      `
        )
        .all(words[0] + "*"); // Wildcard suffix for partial matching
    } else {
      // For multi-word queries, we need a more advanced approach

      // 1. Try exact phrase matching first
      const exactResults = db
        .query(
          `
        SELECT images.* 
        FROM image_fts 
        JOIN images ON image_fts.rowid = images.id
        WHERE image_fts MATCH ?
        ORDER BY rank
        LIMIT 100
      `
        )
        .all(`"${normalizedQuery}"`); // Quoted for phrase search

      if (exactResults.length > 0) {
        searchResults = exactResults;
      } else {
        // 2. Use an OR query with the FTS5 syntax
        // Build a search term like: word1* OR word2* OR word3*
        const searchTerm = words.map((word) => word + "*").join(" OR ");

        searchResults = db
          .query(
            `
          SELECT images.* 
          FROM image_fts 
          JOIN images ON image_fts.rowid = images.id
          WHERE image_fts MATCH ?
          ORDER BY rank
          LIMIT 100
        `
          )
          .all(searchTerm);
      }
    }

    // If standard FTS search doesn't yield enough results, use uFuzzy as fallback
    if (searchResults.length < 3) {
      console.log("Using uFuzzy search fallback for:", query);
      return fuzzySearchFallback(normalizedQuery);
    }

    return searchResults;
  } catch (error) {
    console.error("Search error:", error);

    // If there's an error with the SQLite query, lets try the fuzzy fallback but that is bit slow
    return fuzzySearchFallback(normalizedQuery);
  }
}

// Fallback fuzzy search using uFuzzy when standard FTS doesn't give good results
function fuzzySearchFallback(query) {
  // Get all images - limit to a reasonable number to prevent performance issues
  // Ideally, we'd have some way to pre-filter this list further
  const allImages = db.query("SELECT * FROM images LIMIT 1000").all();

  if (allImages.length === 0) {
    return [];
  }

  // Create a haystack of text from the images
  const haystack = allImages.map((img) => img.ocr_text || "");

  // Configure uFuzzy - using the settings from the demo screenshot
  const uf = new uFuzzy({
    intraIns: 0, // no insertions in intra-matches (per your screenshot)
    intraSub: 1, // allow for 1 substitution (per your screenshot)
    intraTrn: 1, // allow 1 transposition (per your screenshot)
    intraDel: 1, // allow for 1 deletion (per your screenshot)
    intraChars: "[a-z\\d']", // per your screenshot
    intraMode: 2, // MultiInsert mode (per your screenshot)
    interLft: 0, // any (per your screenshot)
    interRgt: 0, // any (per your screenshot)
    interChars: ".", // per your screenshot
    infoThresh: 1000, // per your screenshot
    sortPreset: "search", // per your screenshot
  });

  // First try exact search if that fails then other
  const searchResults = uf.search(haystack, query);

  // If no results, try out-of-order search (allows terms to appear in different order)
  const [idxs, info, order] = searchResults[0] && searchResults[0].length ? searchResults : uf.search(haystack, query, 1); // 1 = allow out-of-order matches

  if (!idxs || idxs.length === 0) {
    return [];
  }

  // Map the results back to our image objects and sort by relevance
  const results = [];

  for (let i = 0; i < order.length; i++) {
    const idx = info.idx[order[i]];
    if (idx >= 0 && idx < allImages.length) {
      results.push(allImages[idx]);
    }

    // Limit to top 100 matches , not more than that
    if (results.length >= 100) {
      break;
    }
  }

  return results;
}

// Helper to normalize text for better matching , cleaning stuff
function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// API server
const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // API routes
    if (url.pathname === "/api/scan") {
      const { folder } = await req.json();
      const results = await processFolder(folder);
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/search") {
      const { query } = await req.json();
      const results = searchImages(query);
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/image") {
      const id = url.searchParams.get("id");
      const image = db.query("SELECT * FROM images WHERE id = ?").get(id);

      if (!image) {
        return new Response("Image not found", { status: 404 });
      }

      const file = Bun.file(image.path);
      return new Response(file);
    }

    // Serve static files from public directory / return the html page ,not using react for simple thing
    const filePath = join(import.meta.dir, "public", url.pathname === "/" ? "index.html" : url.pathname);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:3000`);

// CLI interface for testing
if (process.argv.length > 2) {
  const command = process.argv[2];

  if (command === "scan" && process.argv.length > 3) {
    const folder = process.argv[3];
    processFolder(folder).then((results) => {
      console.log(`Processed ${results.length} images`);
      process.exit(0);
    });
  }

  if (command === "search" && process.argv.length > 3) {
    const query = process.argv[3];
    const results = searchImages(query);
    console.log(`Found ${results.length} results for "${query}":`);
    results.forEach((img) => {
      console.log(`- ${img.filename} (${img.path})`);
    });
    process.exit(0);
  }
}

export { processFolder, searchImages };
